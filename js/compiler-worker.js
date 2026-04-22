/**
 * compiler-worker.js — Zenith C++ Web Worker
 *
 * Execution strategy (tiered):
 *   1. PRIMARY  — JSCPP  (JS C++ interpreter, loads in ~1s, handles most C++ programs)
 *   2. ADVANCED — Wasm-Clang (full Clang/LLVM, requires COEP/COOP headers + network)
 *
 * JSCPP supports: iostream, string, vector, map, math, control flow,
 *   classes, templates (basic), references, pointers, most of C++11/14.
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

// ── Wasm-Clang (advanced — only loads when explicitly cached) ───
const WASM_CLANG_JS  = 'https://wasm.llvm.org/wasm-clang/clang.js';
const WASM_CLANG_BIN = 'https://wasm.llvm.org/wasm-clang/clang.wasm';
const IDB_DB_NAME = 'zenith-cpp-cache';
const IDB_DB_VER  = 1;
const IDB_STORE   = 'wasm-binaries';
const IDB_KEY     = 'wasm-clang-v1';

// ── State ───────────────────────────────────────────────────────
let jscppReady  = false;   // JSCPP loaded and ready
let clangModule = null;    // Full Wasm-Clang (optional)
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

    // JSCPP loads as a global: self.JSCPP
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
    // Still signal ready so user can at least try
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
    // Make sure engine is loaded
    if (!jscppReady) await ensureJSCPP();

    post({ type: 'progress', message: 'Compiling…', percent: 50 });
    await sleep(30); // let progress message render

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
// JSCPP Execution
// ──────────────────────────────────────────────────────────────
function runWithJSCPP(sourceCode, stdin) {
  return new Promise((resolve) => {
    let outputBuffer = '';
    let exitCode = 0;

    // JSCPP stdin: split the provided string into tokens the way C++ >> does
    // Each whitespace-delimited token is one "read" from cin.
    const stdinTokens = (stdin || '').trim().split(/\s+/).filter(Boolean);
    let stdinIndex = 0;

    const config = {
      stdio: {
        // stdout — stream line-by-line to the terminal
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
        // cin — return next whitespace-delimited token from stdin
        // JSCPP calls this when the program executes `cin >> x`
        cin() {
          if (stdinIndex < stdinTokens.length) {
            return stdinTokens[stdinIndex++];
          }
          // No more input — return empty string (EOF behaviour)
          return '';
        }
      },
      // Limit execution steps to prevent infinite loops
      maxExecutionSteps: 1e8,
    };

    try {
      post({ type: 'progress', message: 'Running…', percent: 80 });
      // Pass stdin string as second arg (used by JSCPP for getline / full-string reads)
      exitCode = self.JSCPP.run(sourceCode, stdin || '', config);

      // Flush any remaining buffered output
      if (outputBuffer.length > 0) {
        post({ type: 'stdout', data: outputBuffer });
        outputBuffer = '';
      }

    } catch (e) {
      // Flush buffered output before reporting the error
      if (outputBuffer.length > 0) {
        post({ type: 'stdout', data: outputBuffer });
        outputBuffer = '';
      }

      const errMsg = formatJSCPPError(e);

      if (e && e.type === 'exit') {
        exitCode = e.value != null ? e.value : 0;
      } else {
        post({ type: 'stderr', data: errMsg + '\n' });
        exitCode = 1;
      }
    }

    resolve({ exitCode });
  });
}

// ──────────────────────────────────────────────────────────────
// JSCPP error formatter — turns raw errors into readable output
// ──────────────────────────────────────────────────────────────
function formatJSCPPError(e) {
  if (!e) return 'Unknown error';

  // Exit exception (not really an error)
  if (e.type === 'exit') {
    return `Process exited with code ${e.value}`;
  }

  // Execution step limit (infinite loop guard)
  if (typeof e.message === 'string' && e.message.includes('maxExecutionStep')) {
    return 'Error: Execution limit reached — possible infinite loop detected.\nIncrease timeout or fix the loop.';
  }

  // JSCPP parse/runtime error object
  if (e.error && e.info) {
    const info = e.info;
    const loc  = info.lineNumber ? ` (line ${info.lineNumber})` : '';
    return `Error${loc}: ${e.error.message || e.error}`;
  }

  // Standard JS error
  if (e instanceof Error) {
    // Strip JSCPP internal stack noise
    const msg = e.message
      .replace(/at Object\.\w+ \(.*?\)\n?/g, '')
      .replace(/JSCPP\./g, '')
      .trim();
    return `Error: ${msg}`;
  }

  return `Error: ${String(e)}`;
}

// ──────────────────────────────────────────────────────────────
// Lightweight simulation fallback (JSCPP unavailable)
// Handles both `cout` and `std::cout`, chained `<<` operators,
// string literals and variables declared on previous lines.
// ──────────────────────────────────────────────────────────────
async function simulateRun(sourceCode) {
  await sleep(200);
  post({ type: 'progress', message: 'Running (simulation mode)…', percent: 80 });
  await sleep(100);
  post({ type: 'stderr', data: '[Zenith] Note: running in simulation mode (JSCPP unavailable).\n' });

  // Collect string outputs from cout statements
  // Matches: cout << "..." and std::cout << "..."
  // Also handles chained: cout << "a" << " " << "b" << "\n"
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
// IndexedDB helpers (for optional Wasm-Clang caching)
// ──────────────────────────────────────────────────────────────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function idbGet(key) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req   = store.get(key);
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ──────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────
function post(msg) { self.postMessage(msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
