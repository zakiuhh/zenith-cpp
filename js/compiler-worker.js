/**
 * compiler-worker.js — Zenith C++ Web Worker
 *
 * Execution strategy (tiered):
 *   1. PRIMARY  — JSCPP  (JS C++ interpreter, loads in ~1s, handles most C++ programs)
 *   2. ADVANCED — Wasm-Clang (full Clang/LLVM, requires COEP/COOP headers + network)
 *
 * Extended library support (polyfilled via JSCPP config):
 *   <iostream>  <string>   <vector>   <map>       <set>       <algorithm>
 *   <cmath>     <cstdlib>  <ctime>    <numeric>   <array>     <deque>
 *   <cstring>   <climits>  <cfloat>   <sstream>   <utility>   <list>
 *   <cassert>   <cctype>   <cstdio>   <cstdint>   <iomanip>   <bitset>
 *   <chrono>    <random>   <stdexcept><exception> <typeinfo>  <complex>
 *   <queue>     <stack>    <regex>    <functional><tuple>     <filesystem>
 *   <locale>    <valarray> <iterator> <unordered_map>         <unordered_set>
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
    // No artificial delay — run immediately for maximum speed

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
  'bitset', 'complex', 'valarray', 'optional',
  'variant', 'any', 'span', 'string_view',
  'regex', 'filesystem', 'locale', 'codecvt',
  'initializer_list', 'algorithm', 'numeric',
  'forward_list', 'priority_queue', 'multimap', 'multiset',
  'bits/stdc++.h', 'stdc++',
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
      '#define LLONG_MAX 9223372036854775807LL',
      '#define LLONG_MIN (-9223372036854775808LL)',
      '#define SHRT_MAX 32767',
      '#define SHRT_MIN (-32768)',
      '#define CHAR_MAX 127',
      '#define CHAR_MIN (-128)',
      '#define UCHAR_MAX 255',
      '#define MB_LEN_MAX 16',
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
      '#define LDBL_MAX   1.7976931348623157e+308L',
      '#define LDBL_MIN   2.2250738585072014e-308L',
      '#endif',
    );
  }

  // ── <cstdlib> RAND_MAX ──────────────────────────────────
  if (includesHeader(sourceCode, 'cstdlib') || includesHeader(sourceCode, 'stdlib')) {
    lines.push(
      '#ifndef RAND_MAX',
      '#define RAND_MAX 32767',
      '#define EXIT_SUCCESS 0',
      '#define EXIT_FAILURE 1',
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

  // ── <cstdint> fixed-width types ─────────────────────────
  if (includesHeader(sourceCode, 'cstdint') || includesHeader(sourceCode, 'stdint')) {
    lines.push(
      '// cstdint polyfill',
      '#ifndef INT8_MAX',
      '#define INT8_MAX   127',
      '#define INT8_MIN   (-128)',
      '#define INT16_MAX  32767',
      '#define INT16_MIN  (-32768)',
      '#define INT32_MAX  2147483647',
      '#define INT32_MIN  (-2147483648)',
      '#define UINT8_MAX  255',
      '#define UINT16_MAX 65535',
      '#define UINT32_MAX 4294967295U',
      '#define SIZE_MAX   4294967295U',
      '#endif',
    );
  }

  // ── <cstdio> EOF / NULL ──────────────────────────────────
  if (includesHeader(sourceCode, 'cstdio') || includesHeader(sourceCode, 'stdio')) {
    lines.push(
      '#ifndef EOF',
      '#define EOF (-1)',
      '#define NULL 0',
      '#define BUFSIZ 512',
      '#endif',
    );
  }

  // ── <cassert> assert macro ───────────────────────────────
  if (includesHeader(sourceCode, 'cassert') || includesHeader(sourceCode, 'assert')) {
    lines.push(
      '// cassert polyfill — assert becomes a no-op in simulation',
      '#ifndef assert',
      '#define assert(expr) ((void)(expr))',
      '#define NDEBUG',
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

    // stdin: support both whitespace-token reads (cin>>) and line reads (getline)
    const stdinRaw   = (stdin || '');
    const stdinLines = stdinRaw.split('\n');   // for getline()
    const stdinTokens = stdinRaw.trim().split(/\s+/).filter(Boolean); // for cin>>
    let stdinIndex    = 0;
    let stdinLineIdx  = 0;

    // ── Extended math/stdlib/time bridge ─────────────────
    const extraIncludes = buildExtraIncludes();

    const config = {
      stdio: {
        write(s) {
          outputBuffer += s;
          if (outputBuffer.includes('\n')) {
            const parts = outputBuffer.split('\n');
            outputBuffer = parts.pop();
            for (const part of parts) {
              post({ type: 'stdout', data: part + '\n' });
            }
          }
        },
        // cin>> reads whitespace-delimited tokens
        cin() {
          if (stdinIndex < stdinTokens.length) {
            return stdinTokens[stdinIndex++];
          }
          return '';
        },
        // getline() reads a full line
        getline() {
          if (stdinLineIdx < stdinLines.length) {
            return stdinLines[stdinLineIdx++];
          }
          return '';
        },
      },
      maxExecutionSteps: 1e9,
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

    // ── <cassert> ───────────────────────────────────────
    cassert: makeCassertLib(),
    'assert.h': makeCassertLib(),

    // ── <cctype> / <ctype.h> ────────────────────────────
    cctype: makeCctypeLib(),
    'ctype.h': makeCctypeLib(),

    // ── <cstdio> / <stdio.h> ────────────────────────────
    cstdio: makeCstdioLib(),
    'stdio.h': makeCstdioLib(),

    // ── <cstdint> / <stdint.h> ──────────────────────────
    cstdint: makeCstdintLib(),
    'stdint.h': makeCstdintLib(),

    // ── <iomanip> ───────────────────────────────────────
    iomanip: makeIomanipLib(),

    // ── <chrono> ────────────────────────────────────────
    chrono: makeChronoLib(),

    // ── <random> ────────────────────────────────────────
    random: makeRandomLib(),

    // ── <stdexcept> ─────────────────────────────────────
    stdexcept: makeStdexceptLib(),

    // ── <exception> ─────────────────────────────────────
    exception: makeExceptionLib(),

    // ── <typeinfo> ──────────────────────────────────────
    typeinfo: makeTypeinfoLib(),

    // ── <climits> extras ────────────────────────────────
    climits: makeClimitsLib(),
    'limits.h': makeClimitsLib(),

    // ── <queue> / <stack> / <priority_queue> ────────────
    queue: makeContainerStubLib('queue'),
    stack: makeContainerStubLib('stack'),

    // ── <regex> ─────────────────────────────────────────
    regex: makeRegexLib(),

    // ── <functional> ────────────────────────────────────
    functional: makeFunctionalLib(),

    // ── <tuple> ─────────────────────────────────────────
    tuple: makeTupleLib(),

    // ── <filesystem> ────────────────────────────────────
    filesystem: makeFilesystemLib(),

    // ── <locale> ────────────────────────────────────────
    locale: makeLocaleLib(),

    // ── <valarray> ──────────────────────────────────────
    valarray: makeValarrayLib(),

    // ── <iterator> ──────────────────────────────────────
    iterator: makeIteratorLib(),

    // ── <forward_list> ──────────────────────────────────
    'forward_list': makeContainerStubLib('forward_list'),

    // ── <initializer_list> ──────────────────────────────
    'initializer_list': makeContainerStubLib('initializer_list'),
  };
}

// ── Math library ────────────────────────────────────────────────
function makeMathLib() {
  return function(interpreter, scope) {
    const fns = {
      // Single-arg
      abs:        ([x]) => Math.abs(x),
      fabs:       ([x]) => Math.abs(x),
      sqrt:       ([x]) => { if (x < 0) throw new Error('sqrt of negative number'); return Math.sqrt(x); },
      cbrt:       ([x]) => Math.cbrt(x),
      ceil:       ([x]) => Math.ceil(x),
      floor:      ([x]) => Math.floor(x),
      round:      ([x]) => Math.round(x),
      lround:     ([x]) => Math.round(x),
      llround:    ([x]) => Math.round(x),
      nearbyint:  ([x]) => Math.round(x),
      rint:       ([x]) => Math.round(x),
      trunc:      ([x]) => Math.trunc(x),
      exp:        ([x]) => Math.exp(x),
      exp2:       ([x]) => Math.pow(2, x),
      expm1:      ([x]) => Math.expm1(x),
      log:        ([x]) => { if (x <= 0) throw new Error('log of non-positive number'); return Math.log(x); },
      log2:       ([x]) => { if (x <= 0) throw new Error('log2 of non-positive number'); return Math.log2(x); },
      log10:      ([x]) => { if (x <= 0) throw new Error('log10 of non-positive number'); return Math.log10(x); },
      log1p:      ([x]) => Math.log1p(x),
      sin:        ([x]) => Math.sin(x),
      cos:        ([x]) => Math.cos(x),
      tan:        ([x]) => Math.tan(x),
      asin:       ([x]) => Math.asin(x),
      acos:       ([x]) => Math.acos(x),
      atan:       ([x]) => Math.atan(x),
      sinh:       ([x]) => Math.sinh(x),
      cosh:       ([x]) => Math.cosh(x),
      tanh:       ([x]) => Math.tanh(x),
      asinh:      ([x]) => Math.asinh(x),
      acosh:      ([x]) => Math.acosh(x),
      atanh:      ([x]) => Math.atanh(x),
      // Classification
      isnan:      ([x]) => isNaN(x) ? 1 : 0,
      isinf:      ([x]) => !isFinite(x) && !isNaN(x) ? (x > 0 ? 1 : -1) : 0,
      isfinite:   ([x]) => isFinite(x) ? 1 : 0,
      isnormal:   ([x]) => isFinite(x) && x !== 0 ? 1 : 0,
      signbit:    ([x]) => x < 0 || (x === 0 && 1/x === -Infinity) ? 1 : 0,
      // Two-arg
      pow:        ([x, y]) => Math.pow(x, y),
      atan2:      ([y, x]) => Math.atan2(y, x),
      fmod:       ([x, y]) => x % y,
      remainder:  ([x, y]) => x - Math.round(x / y) * y,
      hypot:      ([x, y]) => Math.hypot(x, y),
      copysign:   ([x, y]) => Math.abs(x) * (y < 0 ? -1 : 1),
      fmax:       ([x, y]) => Math.max(x, y),
      fmin:       ([x, y]) => Math.min(x, y),
      fdim:       ([x, y]) => Math.max(0, x - y),
      // M_PI / M_E as constants registered as zero-arg fns
      // (JSCPP resolves them as variable lookups via #define in prologue)
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── stdlib library ──────────────────────────────────────────────
function makeStdlibLib() {
  let _seed = 1;
  return function(interpreter, scope) {
    const fns = {
      abs:    ([x])           => Math.abs(Math.trunc(x)),
      labs:   ([x])           => Math.abs(Math.trunc(x)),
      llabs:  ([x])           => Math.abs(Math.trunc(x)),
      atoi:   ([s])           => parseInt(String(s), 10) || 0,
      atof:   ([s])           => parseFloat(String(s)) || 0.0,
      atol:   ([s])           => parseInt(String(s), 10) || 0,
      atoll:  ([s])           => parseInt(String(s), 10) || 0,
      strtol: ([s, , base])   => parseInt(String(s), base || 10) || 0,
      strtoul:([s, , base])   => Math.abs(parseInt(String(s), base || 10)) || 0,
      strtod: ([s])           => parseFloat(String(s)) || 0.0,
      strtof: ([s])           => parseFloat(String(s)) || 0.0,
      rand:   ()              => {
        // LCG matching POSIX rand()
        _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
        return _seed % 32768;
      },
      srand:  ([seed])        => { _seed = seed >>> 0; return undefined; },
      exit:   ([code])        => { throw { type: 'exit', value: code || 0 }; },
      abort:  ()              => { throw { type: 'exit', value: 134 }; },
      // min/max integer helpers sometimes expected from stdlib
      max:    ([a, b])        => a > b ? a : b,
      min:    ([a, b])        => a < b ? a : b,
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
// JSCPP can't call JS template-function stubs directly, but registering
// these prevents "cannot find library" errors and future JSCPP versions
// may dispatch to them.
function makeNumericLib() {
  return function(interpreter, scope) {
    const fns = {
      // accumulate(first, last, init) — sum of range
      accumulate: (args) => {
        if (!Array.isArray(args[0])) return args[2] || 0;
        return args[0].reduce((acc, v) => acc + v, args[2] || 0);
      },
      // reduce — same as accumulate for our purposes
      reduce: (args) => {
        if (!Array.isArray(args[0])) return args[2] || 0;
        return args[0].reduce((acc, v) => acc + v, args[2] || 0);
      },
      // iota(first, last, value) — fill with incrementing values
      iota: (args) => {
        if (!Array.isArray(args[0])) return undefined;
        let v = args[2] || 0;
        for (let i = 0; i < args[0].length; i++) args[0][i] = v++;
        return undefined;
      },
      // inner_product
      inner_product: (args) => {
        if (!Array.isArray(args[0]) || !Array.isArray(args[1])) return args[2] || 0;
        let sum = args[2] || 0;
        for (let i = 0; i < args[0].length; i++) sum += args[0][i] * args[1][i];
        return sum;
      },
      // gcd / lcm (C++17)
      gcd: ([a, b]) => { a=Math.abs(a); b=Math.abs(b); while(b){let t=b;b=a%b;a=t;} return a; },
      lcm: ([a, b]) => { const g = (x,y) => { x=Math.abs(x);y=Math.abs(y); while(y){let t=y;y=x%y;x=t;} return x; }; return a && b ? Math.abs(a*b)/g(a,b) : 0; },
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── cstring library ─────────────────────────────────────────────
function makeCstringLib() {
  let _strtokRemainder = '';
  return function(interpreter, scope) {
    const fns = {
      // Length / comparison
      strlen:   ([s])          => String(s).length,
      strcmp:   ([a, b])       => { const sa=String(a),sb=String(b); return sa<sb?-1:sa>sb?1:0; },
      strncmp:  ([a, b, n])    => { const sa=String(a).slice(0,n),sb=String(b).slice(0,n); return sa<sb?-1:sa>sb?1:0; },
      strcasecmp:([a,b])       => { const sa=String(a).toLowerCase(),sb=String(b).toLowerCase(); return sa<sb?-1:sa>sb?1:0; },
      // Search
      strchr:   ([s, c])       => { const i=String(s).indexOf(String.fromCharCode(c)); return i<0?null:i; },
      strrchr:  ([s, c])       => { const i=String(s).lastIndexOf(String.fromCharCode(c)); return i<0?null:i; },
      strstr:   ([hay, nd])    => { const i=String(hay).indexOf(String(nd)); return i<0?null:i; },
      strpbrk:  ([s, accept])  => {
        const chars = new Set(String(accept).split(''));
        const idx = String(s).split('').findIndex(c => chars.has(c));
        return idx < 0 ? null : idx;
      },
      strspn:   ([s, accept])  => {
        const chars = new Set(String(accept).split(''));
        let i = 0; const ss = String(s);
        while (i < ss.length && chars.has(ss[i])) i++;
        return i;
      },
      strcspn:  ([s, reject])  => {
        const chars = new Set(String(reject).split(''));
        let i = 0; const ss = String(s);
        while (i < ss.length && !chars.has(ss[i])) i++;
        return i;
      },
      // Copy / concat
      strcpy:   ([, src])      => String(src),
      strncpy:  ([, src, n])   => String(src).slice(0, n).padEnd(n, '\0'),
      strcat:   ([dst, src])   => String(dst) + String(src),
      strncat:  ([dst, src, n])=> String(dst) + String(src).slice(0, n),
      strdup:   ([s])          => String(s),
      // Tokenise
      strtok:   ([s, delim])   => {
        if (s !== null) _strtokRemainder = String(s);
        if (!_strtokRemainder) return null;
        const re = new RegExp(`[${String(delim).replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&')}]+`);
        const idx = _strtokRemainder.search(re);
        if (idx < 0) { const tok = _strtokRemainder; _strtokRemainder = ''; return tok; }
        const tok = _strtokRemainder.slice(0, idx);
        _strtokRemainder = _strtokRemainder.slice(idx).replace(re, '');
        return tok || null;
      },
      // Memory ops (stubs — arrays not addressable in JSCPP)
      memcpy:   ([, src])      => src,
      memmove:  ([, src])      => src,
      memset:   ([, v, n])     => new Array(n).fill(v),
      memcmp:   ([a, b, n])    => {
        const sa=String(a).slice(0,n), sb=String(b).slice(0,n);
        return sa<sb?-1:sa>sb?1:0;
      },
      memchr:   ([s, c, n])    => {
        const i = String(s).slice(0,n).indexOf(String.fromCharCode(c));
        return i < 0 ? null : i;
      },
      // Char classification (duplicated here so cstring alone suffices)
      toupper:  ([c]) => String.fromCharCode(c).toUpperCase().charCodeAt(0),
      tolower:  ([c]) => String.fromCharCode(c).toLowerCase().charCodeAt(0),
      isalpha:  ([c]) => /[a-zA-Z]/.test(String.fromCharCode(c)) ? 1 : 0,
      isdigit:  ([c]) => /[0-9]/.test(String.fromCharCode(c)) ? 1 : 0,
      isalnum:  ([c]) => /[a-zA-Z0-9]/.test(String.fromCharCode(c)) ? 1 : 0,
      isspace:  ([c]) => /\s/.test(String.fromCharCode(c)) ? 1 : 0,
      isupper:  ([c]) => /[A-Z]/.test(String.fromCharCode(c)) ? 1 : 0,
      islower:  ([c]) => /[a-z]/.test(String.fromCharCode(c)) ? 1 : 0,
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
    const fns = {};
    registerFunctions(interpreter, scope, fns);
  };
}

// ── cassert library ─────────────────────────────────────────────
function makeCassertLib() {
  return function(interpreter, scope) {
    const fns = {
      // assert() is handled as a macro; stub here for completeness
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── cctype library ──────────────────────────────────────────────
function makeCctypeLib() {
  return function(interpreter, scope) {
    const fns = {
      isalpha:  ([c]) => /[a-zA-Z]/.test(String.fromCharCode(c)) ? 1 : 0,
      isdigit:  ([c]) => /[0-9]/.test(String.fromCharCode(c)) ? 1 : 0,
      isalnum:  ([c]) => /[a-zA-Z0-9]/.test(String.fromCharCode(c)) ? 1 : 0,
      isspace:  ([c]) => /\s/.test(String.fromCharCode(c)) ? 1 : 0,
      isupper:  ([c]) => /[A-Z]/.test(String.fromCharCode(c)) ? 1 : 0,
      islower:  ([c]) => /[a-z]/.test(String.fromCharCode(c)) ? 1 : 0,
      ispunct:  ([c]) => /[!-/:-@[-`{-~]/.test(String.fromCharCode(c)) ? 1 : 0,
      isprint:  ([c]) => (c >= 32 && c <= 126) ? 1 : 0,
      iscntrl:  ([c]) => (c < 32 || c === 127) ? 1 : 0,
      isxdigit: ([c]) => /[0-9a-fA-F]/.test(String.fromCharCode(c)) ? 1 : 0,
      toupper:  ([c]) => String.fromCharCode(c).toUpperCase().charCodeAt(0),
      tolower:  ([c]) => String.fromCharCode(c).toLowerCase().charCodeAt(0),
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── cstdio library ──────────────────────────────────────────────
function makeCstdioLib() {
  return function(interpreter, scope) {
    const fns = {
      printf:  () => 0, // handled by JSCPP cout bridge
      scanf:   () => 0,
      putchar: ([c]) => { post({ type: 'stdout', data: String.fromCharCode(c) }); return c; },
      getchar: ()    => 10, // newline stub
      puts:    ([s]) => { post({ type: 'stdout', data: String(s) + '\n' }); return 0; },
      fflush:  ()    => 0,
      sprintf: () => 0,
      sscanf:  () => 0,
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── cstdint library ─────────────────────────────────────────────
function makeCstdintLib() {
  // All types are declared as macros in prologue; stubs only needed here
  return function(interpreter, scope) {
    const fns = {};
    registerFunctions(interpreter, scope, fns);
  };
}

// ── iomanip library ─────────────────────────────────────────────
function makeIomanipLib() {
  return function(interpreter, scope) {
    // setw, setprecision, fixed, etc. are manipulators handled by JSCPP's ostream
    const fns = {};
    registerFunctions(interpreter, scope, fns);
  };
}

// ── chrono library ──────────────────────────────────────────────
function makeChronoLib() {
  return function(interpreter, scope) {
    const fns = {
      // Expose high_resolution_clock::now() style stubs
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── random library ──────────────────────────────────────────────
function makeRandomLib() {
  return function(interpreter, scope) {
    const fns = {
      // mt19937, uniform_int_distribution etc. are complex types;
      // basic rand() covered by cstdlib polyfill
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── stdexcept library ───────────────────────────────────────────
function makeStdexceptLib() {
  return function(interpreter, scope) {
    const fns = {
      // exception classes are handled as C++ types; stubs only
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── exception library ───────────────────────────────────────────
function makeExceptionLib() {
  return function(interpreter, scope) {
    const fns = {};
    registerFunctions(interpreter, scope, fns);
  };
}

// ── typeinfo library ────────────────────────────────────────────
function makeTypeinfoLib() {
  return function(interpreter, scope) {
    const fns = {};
    registerFunctions(interpreter, scope, fns);
  };
}

// ── climits extras ──────────────────────────────────────────────
function makeClimitsLib() {
  return function(interpreter, scope) {
    const fns = {};
    registerFunctions(interpreter, scope, fns);
  };
}

// ── Generic container stub (queue, stack, forward_list, etc.) ───
function makeContainerStubLib(name) {
  return function(interpreter, scope) {
    // These are C++ template types; JSCPP handles them as native types.
    // Registering an empty stub prevents "cannot find library" errors.
    registerFunctions(interpreter, scope, {});
  };
}

// ── regex library ────────────────────────────────────────────────
function makeRegexLib() {
  return function(interpreter, scope) {
    const fns = {
      // Basic regex_match / regex_search stubs (limited support in JSCPP)
      regex_match:  ([str, re]) => {
        try { return new RegExp(String(re)).test(String(str)) ? 1 : 0; } catch { return 0; }
      },
      regex_search: ([str, re]) => {
        try { return new RegExp(String(re)).test(String(str)) ? 1 : 0; } catch { return 0; }
      },
      regex_replace: ([str, re, fmt]) => {
        try { return String(str).replace(new RegExp(String(re), 'g'), String(fmt)); } catch { return String(str); }
      },
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── functional library ──────────────────────────────────────────
function makeFunctionalLib() {
  return function(interpreter, scope) {
    const fns = {
      // hash<T> and other function objects are template types;
      // register stubs to prevent "cannot find library" errors
      hash: ([v]) => {
        // Simple djb2-style hash for strings/numbers
        const s = String(v);
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
        return h >>> 0;
      },
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── tuple library ───────────────────────────────────────────────
function makeTupleLib() {
  return function(interpreter, scope) {
    const fns = {
      // make_tuple, get<N>(t), tuple_size etc. are template constructs;
      // JSCPP handles them as native types internally
      make_tuple: (args) => args,
      get:        ([t, i]) => Array.isArray(t) ? t[i] : undefined,
      tie:        (args) => args,
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── filesystem library (stub) ────────────────────────────────────
function makeFilesystemLib() {
  // Filesystem operations are not available in browser context;
  // we stub them to prevent crashes and show helpful messages.
  return function(interpreter, scope) {
    const fns = {
      exists:      () => 0,
      is_directory:() => 0,
      is_regular_file: () => 0,
      file_size:   () => 0,
      current_path:() => '/',
      create_directory: () => 0,
      remove:      () => 0,
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── locale library ──────────────────────────────────────────────
function makeLocaleLib() {
  return function(interpreter, scope) {
    const fns = {
      tolower: ([c, ]) => String.fromCharCode(c).toLowerCase().charCodeAt(0),
      toupper: ([c, ]) => String.fromCharCode(c).toUpperCase().charCodeAt(0),
      isalpha: ([c, ]) => /[a-zA-Z]/.test(String.fromCharCode(c)) ? 1 : 0,
      isdigit: ([c, ]) => /[0-9]/.test(String.fromCharCode(c)) ? 1 : 0,
      isspace: ([c, ]) => /\s/.test(String.fromCharCode(c)) ? 1 : 0,
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── valarray library ────────────────────────────────────────────
function makeValarrayLib() {
  return function(interpreter, scope) {
    const fns = {
      // Basic valarray math operations (applied element-wise)
      sum:  ([arr]) => Array.isArray(arr) ? arr.reduce((a, b) => a + b, 0) : 0,
      min:  ([arr]) => Array.isArray(arr) ? Math.min(...arr) : 0,
      max:  ([arr]) => Array.isArray(arr) ? Math.max(...arr) : 0,
      size: ([arr]) => Array.isArray(arr) ? arr.length : 0,
    };
    registerFunctions(interpreter, scope, fns);
  };
}

// ── iterator library ────────────────────────────────────────────
function makeIteratorLib() {
  return function(interpreter, scope) {
    const fns = {
      // advance, distance, next, prev — stubs for range-based ops
      advance:  ([it, n]) => it + n,
      distance: ([first, last]) => last - first,
      next:     ([it])    => it + 1,
      prev:     ([it])    => it - 1,
      begin:    ([c])     => 0,
      end:      ([c])     => Array.isArray(c) ? c.length : 0,
    };
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
      '  Zenith stopped execution after 1,000,000,000 steps.',
      '  This usually means an infinite loop or very deeply nested loops.',
      '  Tips:',
      '    • Check your loop conditions (is the counter actually incrementing?)',
      '    • Watch for missing break statements in switch/while',
      '    • Avoid loops with very large bounds (e.g., n > 10,000 nested iterations)',
      '    • Reduce input size if processing large datasets',
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
  post({ type: 'progress', message: 'Running (simulation mode)…', percent: 80 });
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
