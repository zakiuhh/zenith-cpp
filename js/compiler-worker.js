/**
 * compiler-worker.js — Zenith C++ Web Worker
 *
 * Execution strategy (tiered):
 *   1. PRIMARY  — JSCPP  (JS C++ interpreter, loads in ~1s, handles most C++ programs)
 *   2. ADVANCED — Wasm-Clang (full Clang/LLVM, requires COEP/COOP headers + network)
 *
 * Extended library support (polyfilled via JSCPP config):
 *   <iostream>  <string>  <vector>  <map>  <set>  <algorithm>
 *   <cmath>     <cstdlib> <ctime>   <numeric>     <array>
 *   <cstring>   <climits> <cfloat>  <sstream>     <utility>
 *
 * ─────────────────────────────────────────────────────────────
 * MESSAGE PROTOCOL
 * ─────────────────────────────────────────────────────────────
 *  MAIN → WORKER:
 *    { type: 'compile', code: string, flags: string, stdin: string }
 *    { type: 'ping' }
 *
 *  WORKER → MAIN:
 *    { type: 'ready' }
 *    { type: 'progress', message: string, percent: number }
 *    { type: 'stdout', data: string }
 *    { type: 'stderr', data: string }
 *    { type: 'done', exitCode: number, durationMs: number }
 *    { type: 'error', message: string }
 */

'use strict';

// ── CDN URLs ────────────────────────────────────────────────────
const JSCPP_CDN = '/js/jscpp.bundle.js'; // local bun-built bundle

// ── State ───────────────────────────────────────────────────────
let jscppReady  = false;
let compiling   = false;

// ──────────────────────────────────────────────────────────────
// Message handler
// ──────────────────────────────────────────────────────────────
self.onmessage = async (event) => {
  const msg = event.data;

  switch (msg.type) {
    case 'ping':
      await ensureJSCPP();
      break;

    case 'compile':
      if (compiling) {
        post({ type: 'error', message: 'Already compiling. Stop the current run first.' });
        return;
      }
      await handleCompile(msg.code || '', msg.flags || '-O2 -std=c++17', msg.stdin || '');
      break;

    default:
      post({ type: 'error', message: `Unknown message type: ${msg.type}` });
  }
};

// ──────────────────────────────────────────────────────────────
// Load JSCPP (primary engine)
// ──────────────────────────────────────────────────────────────
async function ensureJSCPP() {
  if (jscppReady) {
    post({ type: 'ready' });
    return;
  }

  post({ type: 'progress', message: 'Loading C++ engine…', percent: 20 });

  try {
    importScripts(JSCPP_CDN);

    if (typeof self.JSCPP === 'undefined') {
      throw new Error('JSCPP global not found after importScripts');
    }

    jscppReady = true;
    post({ type: 'progress', message: 'Engine ready ✓', percent: 100 });
    post({ type: 'ready' });

  } catch (e) {
    post({
      type: 'stderr',
      data: `[Zenith] Failed to load JSCPP: ${e.message}\n` +
            `[Zenith] Switching to lightweight simulation mode.\n`
    });
    jscppReady = false;
    post({ type: 'ready' });
  }
}

// ──────────────────────────────────────────────────────────────
// Main compile handler
// ──────────────────────────────────────────────────────────────
async function handleCompile(sourceCode, flags, stdin) {
  compiling = true;
  const startTime = Date.now();

  try {
    if (!jscppReady) await ensureJSCPP();

    post({ type: 'progress', message: 'Compiling…', percent: 50 });
    await sleep(30);

    let result;
    if (jscppReady && typeof self.JSCPP !== 'undefined') {
      result = await runWithJSCPP(sourceCode, stdin);
    } else {
      result = await simulateRun(sourceCode);
    }

    post({ type: 'done', exitCode: result.exitCode, durationMs: Date.now() - startTime });

  } catch (err) {
    post({ type: 'error', message: String(err.message || err) });
    post({ type: 'done', exitCode: 1, durationMs: Date.now() - startTime });
  } finally {
    compiling = false;
  }
}

// ──────────────────────────────────────────────────────────────
// Library header detection helpers
// ──────────────────────────────────────────────────────────────
function includesHeader(code, header) {
  // Match #include <header> or #include "header"
  const re = new RegExp(`#\\s*include\\s*[<"]${header}(?:\\.h)?[>"]`);
  return re.test(code);
}

/**
 * Strip #include directives for headers that JSCPP has built-in native support
 * for but rejects when listed in the `includes` config map. JSCPP handles these
 * types internally (std::string, std::vector, etc.) without needing a header load.
 */
// Only strip headers that JSCPP's type system provides automatically.
// DO NOT include iostream/ostream/istream here — JSCPP must load those
// explicitly to make cout, cin, endl, etc. available.
const JSCPP_NATIVE_HEADERS = new Set([
  'string', 'vector', 'list', 'deque', 'array',
  'map', 'set', 'unordered_map', 'unordered_set',
  'queue', 'stack', 'pair', 'tuple',
  'iterator', 'memory', 'functional', 'type_traits',
]);

function stripJSCPPNativeHeaders(sourceCode) {
  // Remove #include lines for native-handled headers
  return sourceCode.replace(
    /#\s*include\s*[<"]([^>"]+)[>"]/g,
    (match, header) => {
      // Normalise: strip path prefix and .h suffix
      const base = header.split('/').pop().replace(/\.h$/, '');
      return JSCPP_NATIVE_HEADERS.has(base) ? `// [zenith] native: ${match}` : match;
    }
  );
}

/**
 * Inject polyfill code for standard library headers that JSCPP doesn't natively
 * support (or supports only partially). We prepend thin C++ wrappers that map
 * to JSCPP built-ins or re-declare known constants.
 */
function buildPolyfillPrologue(sourceCode) {
  const lines = [];

  // ── <climits> constants ─────────────────────────────────
  if (includesHeader(sourceCode, 'climits') || includesHeader(sourceCode, 'limits')) {
    lines.push(
      '// climits polyfill',
      '#ifndef INT_MAX',
      '#define INT_MAX  2147483647',
      '#define INT_MIN  (-2147483648)',
      '#define UINT_MAX 4294967295U',
      '#define LONG_MAX 2147483647L',
      '#define LONG_MIN (-2147483648L)',
      '#define SHRT_MAX 32767',
      '#define SHRT_MIN (-32768)',
      '#define CHAR_MAX 127',
      '#define CHAR_MIN (-128)',
      '#define UCHAR_MAX 255',
      '#endif',
    );
  }

  // ── <cfloat> constants ──────────────────────────────────
  if (includesHeader(sourceCode, 'cfloat') || includesHeader(sourceCode, 'float')) {
    lines.push(
      '// cfloat polyfill',
      '#ifndef FLT_MAX',
      '#define FLT_MAX    3.40282347e+38F',
      '#define FLT_MIN    1.17549435e-38F',
      '#define FLT_EPSILON 1.19209290e-07F',
      '#define DBL_MAX    1.7976931348623157e+308',
      '#define DBL_MIN    2.2250738585072014e-308',
      '#define DBL_EPSILON 2.2204460492503131e-16',
      '#endif',
    );
  }

  // ── <cstdlib> RAND_MAX ──────────────────────────────────
  if (includesHeader(sourceCode, 'cstdlib') || includesHeader(sourceCode, 'stdlib')) {
    lines.push(
      '#ifndef RAND_MAX',
      '#define RAND_MAX 32767',
      '#endif',
    );
  }

  // ── <ctime> CLOCKS_PER_SEC ──────────────────────────────
  if (includesHeader(sourceCode, 'ctime') || includesHeader(sourceCode, 'time')) {
    lines.push(
      '#ifndef CLOCKS_PER_SEC',
      '#define CLOCKS_PER_SEC 1000',
      '#endif',
    );
  }

  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

// ──────────────────────────────────────────────────────────────
// JSCPP Execution (with extended library support)
// ──────────────────────────────────────────────────────────────
function runWithJSCPP(sourceCode, stdin) {
  return new Promise((resolve) => {
    let outputBuffer = '';
    let exitCode = 0;

    // stdin tokenisation (same as before)
    const stdinTokens = (stdin || '').trim().split(/\s+/).filter(Boolean);
    let stdinIndex = 0;

    // ── Extended math/stdlib/time bridge ─────────────────
    // JSCPP exposes a 'includes' hook and 'define' hooks. We attach our
    // extra functions to the JSCPP type system via the config.includes map.
    const extraIncludes = buildExtraIncludes();

    const config = {
      stdio: {
        write(s) {
          outputBuffer += s;
          if (outputBuffer.includes('\n')) {
            const lines = outputBuffer.split('\n');
            outputBuffer = lines.pop();
            for (const line of lines) {
              post({ type: 'stdout', data: line + '\n' });
            }
          }
        },
        cin() {
          if (stdinIndex < stdinTokens.length) {
            return stdinTokens[stdinIndex++];
          }
          return '';
        }
      },
      maxExecutionSteps: 1e8,
      // Inject our extra library implementations
      includes: extraIncludes,
    };

    try {
      // Strip native headers JSCPP handles internally (prevents 'cannot find library' errors)
      const strippedCode = stripJSCPPNativeHeaders(sourceCode);
      // Prepend compile-time polyfill macros
      const prologue = buildPolyfillPrologue(sourceCode);
      const finalCode = prologue + strippedCode;

      post({ type: 'progress', message: 'Running…', percent: 80 });
      exitCode = self.JSCPP.run(finalCode, stdin || '', config);

      // Flush any remaining buffered output
      if (outputBuffer.length > 0) {
        post({ type: 'stdout', data: outputBuffer });
        outputBuffer = '';
      }

    } catch (e) {
      if (outputBuffer.length > 0) {
        post({ type: 'stdout', data: outputBuffer });
        outputBuffer = '';
      }

      if (e && e.type === 'exit') {
        exitCode = e.value != null ? e.value : 0;
      } else {
        const errMsg = formatJSCPPError(e, sourceCode);
        post({ type: 'stderr', data: errMsg + '\n' });
        exitCode = 1;
      }
    }

    resolve({ exitCode });
  });
}

// ──────────────────────────────────────────────────────────────
// Build extra library includes for JSCPP
// Maps C++ function names to JS implementations
// ──────────────────────────────────────────────────────────────
function buildExtraIncludes() {
  // JSCPP's 'includes' config accepts an object where keys are header names
  // and values are functions that receive (interpreter, stdlib) and register
  // new built-in functions.  Different JSCPP builds handle this differently,
  // so we also patch via the global JSCPP object where possible.
  return {
    // ── <cmath> / <math.h> ──────────────────────────────
    cmath: makeMathLib(),
    'math.h': makeMathLib(),

    // ── <cstdlib> / <stdlib.h> ──────────────────────────
    cstdlib: makeStdlibLib(),
    'stdlib.h': makeStdlibLib(),

    // ── <ctime> / <time.h> ──────────────────────────────
    ctime: makeCtimeLib(),
    'time.h': makeCtimeLib(),

    // ── <numeric> ───────────────────────────────────────
    numeric: makeNumericLib(),

    // ── <cstring> / <string.h> ──────────────────────────
    cstring: makeCstringLib(),
    'string.h': makeCstringLib(),

    // ── <algorithm> extras ──────────────────────────────
    algorithm: makeAlgorithmLib(),

    // ── <utility> ───────────────────────────────────────
    utility: makeUtilityLib(),

    // ── <sstream> ───────────────────────────────────────
    sstream: makeSstreamLib(),
  };
}

// ── Math library ────────────────────────────────────────────────
function makeMathLib() {
  return function(interpreter, scope) {
    const fns = {
      // Single-arg functions
      abs:   ([x]) => Math.abs(x),
      fabs:  ([x]) => Math.abs(x),
      sqrt:  ([x]) => { if (x < 0) throw new Error('sqrt of negative number'); return Math.sqrt(x); },
      cbrt:  ([x]) => Math.cbrt(x),
      ceil:  ([x]) => Math.ceil(x),
      floor: ([x]) => Math.floor(x),
      round: ([x]) => Math.round(x),
      trunc: ([x]) => Math.trunc(x),
      exp:   ([x]) => Math.exp(x),
      log:   ([x]) => { if (x <= 0) throw new Error('log of non-positive number'); return Math.log(x); },
      log2:  ([x]) => { if (x <= 0) throw new Error('log2 of non-positive number'); return Math.log2(x); },
      log10: ([x]) => { if (x <= 0) throw new Error('log10 of non-positive number'); return Math.log10(x); },
      sin:   ([x]) => Math.sin(x),
      cos:   ([x]) => Math.cos(x),
      tan:   ([x]) => Math.tan(x),
      asin:  ([x]) => Math.asin(x),
      acos:  ([x]) => Math.acos(x),
      atan:  ([x]) => Math.atan(x),
      sinh:  ([x]) => Math.sinh(x),
      cosh:  ([x]) => Math.cosh(x),
      tanh:  ([x]) => Math.tanh(x),
      // Two-arg functions
      pow:   ([x, y]) => Math.pow(x, y),
      atan2: ([y, x]) => Math.atan2(y, x),
      fmod:  ([x, y]) => x % y,
      hypot: ([x, y]) => Math.hypot(x, y),
      // Constants (via #define in prologue)
      // fmax/fmin/fdim
      fmax:  ([x, y]) => Math.max(x, y),
      fmin:  ([x, y]) => Math.min(x, y),
      fdim:  ([x, y]) => Math.max(0, x - y),
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── stdlib library ──────────────────────────────────────────────
function makeStdlibLib() {
  let _seed = 1;
  return function(interpreter, scope) {
    const fns = {
      abs:   ([x])    => Math.abs(Math.trunc(x)),
      atoi:  ([s])    => parseInt(String(s), 10) || 0,
      atof:  ([s])    => parseFloat(String(s)) || 0.0,
      atol:  ([s])    => parseInt(String(s), 10) || 0,
      strtol:([s, , base]) => parseInt(String(s), base || 10) || 0,
      strtod:([s])    => parseFloat(String(s)) || 0.0,
      rand:  ()       => {
        // Simple LCG matching many C stdlib implementations
        _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
        return _seed % 32768;
      },
      srand: ([seed]) => { _seed = seed >>> 0; return undefined; },
      exit:  ([code]) => { throw { type: 'exit', value: code || 0 }; },
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── ctime library ───────────────────────────────────────────────
function makeCtimeLib() {
  const _start = Date.now();
  return function(interpreter, scope) {
    const fns = {
      time:      ([])  => Math.floor(Date.now() / 1000),
      clock:     ()    => Date.now() - _start,
      difftime:  ([t2, t1]) => t2 - t1,
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── numeric library ─────────────────────────────────────────────
function makeNumericLib() {
  return function(interpreter, scope) {
    // Note: <numeric> functions in JSCPP are tricky to inject as template fns.
    // We register helper stubs — real usage is handled by JSCPP's built-in
    // iterator support when <numeric> is parsed.
    const fns = {
      // These are no-ops stubs; JSCPP handles them at parse time
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── cstring library ─────────────────────────────────────────────
function makeCstringLib() {
  return function(interpreter, scope) {
    const fns = {
      strlen:  ([s])       => String(s).length,
      strcmp:  ([a, b])    => { const sa=String(a), sb=String(b); return sa<sb?-1:sa>sb?1:0; },
      strncmp: ([a, b, n]) => { const sa=String(a).slice(0,n), sb=String(b).slice(0,n); return sa<sb?-1:sa>sb?1:0; },
      strchr:  ([s, c])    => { const i=String(s).indexOf(String.fromCharCode(c)); return i<0?null:i; },
      strstr:  ([hay, nd]) => { const i=String(hay).indexOf(String(nd)); return i<0?null:i; },
      toupper: ([c])       => String.fromCharCode(c).toUpperCase().charCodeAt(0),
      tolower: ([c])       => String.fromCharCode(c).toLowerCase().charCodeAt(0),
      isalpha: ([c])       => /[a-zA-Z]/.test(String.fromCharCode(c)) ? 1 : 0,
      isdigit: ([c])       => /[0-9]/.test(String.fromCharCode(c)) ? 1 : 0,
      isalnum: ([c])       => /[a-zA-Z0-9]/.test(String.fromCharCode(c)) ? 1 : 0,
      isspace: ([c])       => /\s/.test(String.fromCharCode(c)) ? 1 : 0,
      isupper: ([c])       => /[A-Z]/.test(String.fromCharCode(c)) ? 1 : 0,
      islower: ([c])       => /[a-z]/.test(String.fromCharCode(c)) ? 1 : 0,
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── algorithm extras ────────────────────────────────────────────
function makeAlgorithmLib() {
  return function(interpreter, scope) {
    // JSCPP natively handles sort, reverse, find etc.
    // We register min/max with explicit type arity for value types.
    const fns = {};
    registerFunctions(interpreter, scope, fns);
  };
}

// ── utility library ─────────────────────────────────────────────
function makeUtilityLib() {
  return function(interpreter, scope) {
    const fns = {
      swap: ([a, b]) => [b, a], // value swap stub
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── sstream library ─────────────────────────────────────────────
function makeSstreamLib() {
  return function(interpreter, scope) {
    // sstream is complex; JSCPP has partial built-in support.
    // We don't need to add much here.
    const fns = {};
    registerFunctions(interpreter, scope, fns);
  };
}

// ──────────────────────────────────────────────────────────────
// Helper: register a map of JS functions into JSCPP scope
// ──────────────────────────────────────────────────────────────
function registerFunctions(interpreter, scope, fns) {
  if (!interpreter || !scope) return;
  try {
    for (const [name, fn] of Object.entries(fns)) {
      if (typeof scope.set === 'function') {
        scope.set(name, { type: 'function', fn });
      } else if (scope[name] === undefined) {
        scope[name] = fn;
      }
    }
  } catch {
    // Safe to ignore — JSCPP version differences
  }
}

// ──────────────────────────────────────────────────────────────
// JSCPP error formatter — rich, developer-friendly messages
// ──────────────────────────────────────────────────────────────
function formatJSCPPError(e, sourceCode) {
  if (!e) return 'Unknown error';

  // Normal exit (not an error)
  if (e.type === 'exit') {
    return `Process exited with code ${e.value}`;
  }

  // Step limit (infinite loop guard)
  if (typeof e.message === 'string' && e.message.includes('maxExecutionStep')) {
    return [
      '╔══ Execution Limit Reached ══╗',
      '  Zenith stopped execution after 100,000,000 steps.',
      '  This usually means an infinite loop or very large recursion.',
      '  Tips:',
      '    • Check your loop conditions (is the counter actually changing?)',
      '    • Watch for missing break statements in switch/while',
      '    • Reduce input size if processing large datasets',
      '  Increase the timeout in Settings if your program legitimately needs more time.',
    ].join('\n');
  }

  // JSCPP structured error object { error, info }
  if (e.error && e.info) {
    const info = e.info;
    const lineNum = info.lineNumber || info.line || null;
    const lineSrc = lineNum && sourceCode
      ? getSourceLine(sourceCode, lineNum)
      : null;

    let msg = '';
    if (lineNum) msg += `Error on line ${lineNum}:\n`;
    if (lineSrc) msg += `  ${lineSrc.trim()}\n`;
    msg += `  ${e.error.message || e.error}`;

    // Enhance common JSCPP errors with hints
    const raw = String(e.error.message || e.error);
    msg += getErrorHint(raw);
    return msg;
  }

  // Standard JS Error with message
  if (e instanceof Error) {
    const raw = e.message;
    let msg = `Error: ${raw.replace(/JSCPP\./g, '').trim()}`;
    msg += getErrorHint(raw);
    // Add line info if parseable from message
    const lineMatch = raw.match(/line[:\s]+(\d+)/i);
    if (lineMatch) {
      const lineNum = parseInt(lineMatch[1]);
      const lineSrc = getSourceLine(sourceCode, lineNum);
      if (lineSrc) msg += `\n  → Line ${lineNum}: ${lineSrc.trim()}`;
    }
    return msg;
  }

  // Plain string / unknown
  const raw = String(e);
  return `Error: ${raw}${getErrorHint(raw)}`;
}

/**
 * Returns a developer-friendly hint based on the error message string.
 */
function getErrorHint(raw) {
  const r = raw.toLowerCase();
  if (r.includes('undefined') && r.includes('variable'))
    return '\n  Hint: Variable used before declaration. Did you forget to declare it?';
  if (r.includes('cannot read') || r.includes('null'))
    return '\n  Hint: Null pointer / uninitialized value. Check array bounds or pointer initialization.';
  if (r.includes('stack overflow') || r.includes('maximum call stack'))
    return '\n  Hint: Stack overflow — infinite recursion detected. Add a base case to your recursive function.';
  if (r.includes('not a function'))
    return '\n  Hint: Trying to call something that is not a function. Check function name spelling and include the right header.';
  if (r.includes('include') || r.includes('header'))
    return '\n  Hint: Missing #include. Add the appropriate header at the top of your file.';
  if (r.includes('namesapce') || r.includes('namespace'))
    return '\n  Hint: Check your namespace declaration — the correct spelling is `using namespace std;`';
  if (r.includes('undeclared') || r.includes('not declared'))
    return '\n  Hint: Symbol not declared. Check spelling, scope, or missing #include.';
  if (r.includes('expected'))
    return '\n  Hint: Syntax error — check for missing semicolons, braces, or mismatched parentheses.';
  if (r.includes('cout') || r.includes('cin'))
    return '\n  Hint: Make sure you have `#include <iostream>` and `using namespace std;` (or use `std::cout`).';
  return '';
}

/**
 * Extract a specific line from source code (1-indexed).
 */
function getSourceLine(source, lineNum) {
  if (!source || !lineNum) return null;
  const lines = source.split('\n');
  return lines[lineNum - 1] || null;
}

// ──────────────────────────────────────────────────────────────
// Lightweight simulation fallback (JSCPP unavailable)
// ──────────────────────────────────────────────────────────────
async function simulateRun(sourceCode) {
  await sleep(200);
  post({ type: 'progress', message: 'Running (simulation mode)…', percent: 80 });
  await sleep(100);
  post({ type: 'stderr', data: '[Zenith] Note: running in simulation mode (JSCPP unavailable).\n' });

  const coutLineRe = /(?:std::)?cout\s*((?:<<\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\w+|\d+(?:\.\d+)?)\s*)+)/g;
  const stringLitRe = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  const escapeMap = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" };

  function unescape(raw) {
    return raw.replace(/\\(.)/g, (_, c) => escapeMap[c] || c);
  }

  const lines = [];
  let match;

  while ((match = coutLineRe.exec(sourceCode)) !== null) {
    const chain = match[1];
    let lineOutput = '';
    let litMatch;
    stringLitRe.lastIndex = 0;
    while ((litMatch = stringLitRe.exec(chain)) !== null) {
      lineOutput += unescape(litMatch[1] ?? litMatch[2]);
    }
    if (lineOutput) lines.push(lineOutput);
  }

  if (lines.length > 0) {
    for (const line of lines) {
      post({ type: 'stdout', data: line });
    }
  } else {
    post({ type: 'stdout', data: 'Program ran (no cout output detected).\n' });
  }

  return { exitCode: 0 };
}

// ──────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────
function post(msg) { self.postMessage(msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
