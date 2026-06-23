/**
 * main.js — Zenith C++ Orchestrator
 *
 * Wires together:
 *   - zenithEditor  (Monaco)
 *   - zenithTerminal (Xterm.js)
 *   - compiler-worker.js (Web Worker)
 *   - UI controls (Run, Stop, Settings, Clear)
 */

'use strict';

// ── State ──────────────────────────────────────────────────────
let worker         = null;
let workerReady    = false;
let isRunning      = false;
let runStartTime   = null;
let timeoutHandle  = null;
let compilerFlags  = '-O2 -std=c++17 -Wall';
let execTimeout    = 30000; // ms

// ── DOM refs ───────────────────────────────────────────────────
const btnRun      = document.getElementById('btn-run');
const btnStop     = document.getElementById('btn-stop');
const btnSettings = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnClear    = document.getElementById('btn-clear-terminal');
const btnToggleStdin = document.getElementById('btn-toggle-stdin');
const btnClearStdin  = document.getElementById('btn-clear-stdin');
const btnFunctions   = document.getElementById('btn-functions');
const stdinPanel  = document.getElementById('stdin-panel');
const stdinArea   = document.getElementById('stdin-textarea');
const statusEl    = document.getElementById('status-indicator');
const statusText  = document.getElementById('status-text');
const exitBadge   = document.getElementById('exit-code-badge');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMsg  = document.getElementById('loading-message');
const settingsPanel = document.getElementById('settings-panel');

// Mobile clipboard buttons
const btnMobilePaste = document.getElementById('btn-mobile-paste');
const btnMobileCopy  = document.getElementById('btn-mobile-copy');

// Settings controls
const fontSizeSlider  = document.getElementById('setting-font-size');
const fontSizeDisplay = document.getElementById('font-size-display');
const wrapOn          = document.getElementById('setting-wrap-on');
const wrapOff         = document.getElementById('setting-wrap-off');
const flagsInput      = document.getElementById('setting-compiler-flags');
const timeoutSlider   = document.getElementById('setting-timeout');
const timeoutDisplay  = document.getElementById('timeout-display');

// ──────────────────────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────────────────────
async function init() {
  updateLoadingMessage('Loading editor engine…');

  // Init Terminal first (fast)
  zenithTerminal.init();

  // Init Monaco
  try {
    await zenithEditor.init();
    updateLoadingMessage('Starting compiler worker…');
  } catch (e) {
    updateLoadingMessage('Editor failed to load. Please refresh.');
    return;
  }

  // Hide loading overlay
  loadingOverlay.classList.add('hidden');
  setTimeout(() => { loadingOverlay.style.display = 'none'; }, 450);

  // Start worker
  spawnWorker();

  // Bind UI
  bindUI();

  // Init Functions panel
  if (window.functionsPanel) {
    zenithEditor.onReady(() => {
      functionsPanel.init();
    });
  }

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isRunning) triggerRun();
    }
    if (e.key === 'Escape') closeSettings();
  });

  // Pane resizer
  initResizer();
}

// ──────────────────────────────────────────────────────────────
// Worker lifecycle
// ──────────────────────────────────────────────────────────────
function spawnWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    workerReady = false;
  }

  worker = new Worker('js/compiler-worker.js');
  worker.onmessage = handleWorkerMessage;
  worker.onerror   = handleWorkerError;

  setStatus('loading');
  worker.postMessage({ type: 'ping' });
}

function handleWorkerMessage(event) {
  const msg = event.data;

  switch (msg.type) {
    case 'ready':
      workerReady = true;
      setStatus('idle');
      zenithTerminal.writeInfo('  Compiler ready. Click Run to compile your code.');
      zenithTerminal.writeln('');
      btnRun.disabled = false;
      break;

    case 'progress':
      setStatus('loading');
      updateStatusText(msg.message);
      zenithTerminal.writeInfo(`  ${msg.message}`);
      break;

    case 'stdout':
      zenithTerminal.writeStdout(msg.data);
      break;

    case 'stderr':
      zenithTerminal.writeStderr(msg.data);
      break;

    case 'done':
      clearTimeout(timeoutHandle);
      isRunning = false;
      const durationMs = runStartTime ? Date.now() - runStartTime : msg.durationMs;
      zenithTerminal.writeRunResult(msg.exitCode, durationMs);
      setRunState(false, msg.exitCode);
      updateExitBadge(msg.exitCode);
      // Mark file as saved
      const dot = document.querySelector('.dot-unsaved');
      if (dot) dot.classList.add('hidden');
      break;

    case 'error':
      clearTimeout(timeoutHandle);
      isRunning = false;
      zenithTerminal.writeStderr(`\n[Worker Error] ${msg.message}\n`);
      setRunState(false, 1);
      setStatus('error');
      break;
  }
}

function handleWorkerError(e) {
  clearTimeout(timeoutHandle);
  isRunning = false;
  zenithTerminal.writeStderr(`\n[Fatal Worker Error] ${e.message}\n`);
  zenithTerminal.writeInfo('  Worker crashed. Restarting…');
  setRunState(false, 1);
  setStatus('error');
  setTimeout(spawnWorker, 1500);
}

// ──────────────────────────────────────────────────────────────
// Run / Stop
// ──────────────────────────────────────────────────────────────
function triggerRun() {
  if (!workerReady) {
    showToast('Compiler is still loading…');
    return;
  }
  if (isRunning) return;

  const code = zenithEditor.getCode();
  if (!code.trim()) {
    showToast('Editor is empty');
    return;
  }

  // Read stdin from the textarea panel (always — user leaves it empty if not needed)
  const stdin = stdinArea ? stdinArea.value : '';
  executeCode(code, stdin);
}

/**
 * Fire off the actual compile+run with a resolved stdin string.
 */
function executeCode(code, stdin) {
  isRunning    = true;
  runStartTime = Date.now();
  exitBadge.classList.add('hidden');

  zenithTerminal.writeCompileHeader();
  setStatus('compiling');
  setRunState(true);

  worker.postMessage({ type: 'compile', code, flags: compilerFlags, stdin });

  timeoutHandle = setTimeout(() => {
    if (isRunning) {
      zenithTerminal.writeln('');
      zenithTerminal.writeWarn('  [Zenith] Execution timed out — terminating worker.');
      triggerStop();
    }
  }, execTimeout);
}

function triggerStop() {
  clearTimeout(timeoutHandle);
  if (!isRunning && !workerReady) return;

  isRunning = false;
  zenithTerminal.writeln('');
  zenithTerminal.writeWarn('  [Zenith] Execution stopped by user.');
  zenithTerminal.writeRunResult(130, null); // 130 = SIGINT

  // Kill and restart worker
  if (worker) {
    worker.terminate();
    worker = null;
    workerReady = false;
  }

  setRunState(false, 130);
  setStatus('idle');

  setTimeout(spawnWorker, 100);
}

// ──────────────────────────────────────────────────────────────
// UI State helpers
// ──────────────────────────────────────────────────────────────
function setRunState(running, exitCode) {
  if (running) {
    btnRun.classList.add('running');
    btnRun.disabled = true;
    btnStop.disabled = false;
    btnStop.classList.remove('opacity-40', 'cursor-not-allowed');
    setStatus('compiling');
  } else {
    btnRun.classList.remove('running');
    btnRun.disabled = false;
    btnStop.disabled = true;
    btnStop.classList.add('opacity-40', 'cursor-not-allowed');
    setStatus(exitCode === 0 ? 'done' : exitCode == null ? 'idle' : 'error');
  }
}

function setStatus(state) {
  const validStates = ['idle','loading','compiling','running','done','error'];
  statusEl.className = statusEl.className
    .split(' ')
    .filter(c => !c.startsWith('status-'))
    .join(' ');
  statusEl.classList.add(`status-${state}`);

  const labels = {
    idle:      'Ready',
    loading:   'Loading',
    compiling: 'Compiling',
    running:   'Running',
    done:      'Done',
    error:     'Error',
  };
  statusText.textContent = labels[state] || state;
}

function updateStatusText(msg) {
  statusText.textContent = msg;
}

function updateLoadingMessage(msg) {
  if (loadingMsg) loadingMsg.textContent = msg;
}

function updateExitBadge(code) {
  exitBadge.textContent = `exit: ${code}`;
  exitBadge.className = `font-mono ${code === 0 ? 'exit-ok' : 'exit-err'}`;
  exitBadge.style.fontSize = '10px';
  exitBadge.classList.remove('hidden');
}

// ──────────────────────────────────────────────────────────────
// Settings panel
// ──────────────────────────────────────────────────────────────
function openSettings() {
  settingsPanel.classList.add('open');
}

function closeSettings() {
  settingsPanel.classList.remove('open');
}

// ──────────────────────────────────────────────────────────────
// Toast notification
// ──────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ──────────────────────────────────────────────────────────────
// Pane Resizer (drag to resize)
// ──────────────────────────────────────────────────────────────
function initResizer() {
  const resizer    = document.getElementById('resizer');
  const editorPane = document.getElementById('editor-pane');
  const ideLayout  = document.getElementById('ide-layout');
  if (!resizer || !editorPane) return;

  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX     = e.clientX;
    startWidth = editorPane.getBoundingClientRect().width;
    resizer.classList.add('dragging');

    const onMove = (e) => {
      const totalWidth = ideLayout.getBoundingClientRect().width - 4; // subtract resizer
      const newLeft = Math.min(Math.max(startWidth + (e.clientX - startX), 200), totalWidth - 200);
      const rightSide = totalWidth - newLeft;
      ideLayout.style.gridTemplateColumns = `${newLeft}px 4px ${rightSide}px`;
      zenithEditor.layout();
      zenithTerminal.fit();
    };

    const onUp = () => {
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ──────────────────────────────────────────────────────────────
// Bind all UI events
// ──────────────────────────────────────────────────────────────
function bindUI() {
  // Run / Stop
  btnRun.addEventListener('click', triggerRun);
  btnStop.addEventListener('click', triggerStop);

  // Clear terminal
  btnClear.addEventListener('click', () => {
    zenithTerminal.clear();
    zenithTerminal.writeInfo('  Terminal cleared.');
  });

  // Settings open/close
  btnSettings.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent bubble to document "click outside" handler
    if (settingsPanel.classList.contains('open')) {
      closeSettings();
    } else {
      openSettings();
    }
  });
  btnCloseSettings.addEventListener('click', closeSettings);

  // Functions panel toggle
  if (btnFunctions && window.functionsPanel) {
    btnFunctions.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close settings if open
      if (settingsPanel.classList.contains('open')) closeSettings();
      functionsPanel.toggle();
      btnFunctions.classList.toggle('active', functionsPanel._isOpen);
    });
  }

  // Click outside settings to close
  document.addEventListener('click', (e) => {
    if (settingsPanel.classList.contains('open') &&
        !settingsPanel.contains(e.target) &&
        !btnSettings.contains(e.target)) {
      closeSettings();
    }
  });

  // Font size
  fontSizeSlider.addEventListener('input', () => {
    const size = parseInt(fontSizeSlider.value);
    fontSizeDisplay.textContent = size;
    zenithEditor.setFontSize(size);
  });

  // Word wrap
  wrapOn.addEventListener('click', () => {
    wrapOn.classList.add('active'); wrapOff.classList.remove('active');
    zenithEditor.setWordWrap(true);
  });
  wrapOff.addEventListener('click', () => {
    wrapOff.classList.add('active'); wrapOn.classList.remove('active');
    zenithEditor.setWordWrap(false);
  });

  // Compiler flags
  flagsInput.addEventListener('change', () => {
    compilerFlags = flagsInput.value.trim() || '-O2 -std=c++17';
  });

  // Timeout
  timeoutSlider.addEventListener('input', () => {
    const secs = parseInt(timeoutSlider.value);
    timeoutDisplay.textContent = `${secs}s`;
    execTimeout = secs * 1000;
  });

  // ── Stdin panel toggle ─────────────────────────────────────────
  if (btnToggleStdin && stdinPanel) {
    btnToggleStdin.addEventListener('click', () => {
      toggleStdinPanel();
    });
  }

  // ── Clear stdin ────────────────────────────────────────────────
  if (btnClearStdin && stdinArea) {
    btnClearStdin.addEventListener('click', () => {
      stdinArea.value = '';
      stdinArea.focus();
    });
  }

  // ── Ctrl+Enter inside stdin textarea also triggers run ─────────
  if (stdinArea) {
    stdinArea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isRunning) triggerRun();
      }
    });
  }

  // ── Auto-show stdin panel when code has cin ────────────────────
  // (observe editor changes and hint the user)
  let stdinAutoShown = false;
  if (typeof zenithEditor !== 'undefined') {
    // We check once after a short delay (editor initialises async)
    setTimeout(() => {
      const checkForCin = () => {
        if (stdinAutoShown) return;
        const code = zenithEditor.getCode ? zenithEditor.getCode() : '';
        if (/(?:std\s*::\s*)?cin\s*>>|getline\s*\(\s*(?:std\s*::\s*)?cin/.test(code)) {
          showStdinPanel();
          stdinAutoShown = true;
        }
      };
      // Check initially
      checkForCin();
    }, 600);
  }

  // ── Mobile clipboard ──────────────────────────────────────────
  if (btnMobilePaste) {
    btnMobilePaste.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
          showToast('Clipboard is empty');
          return;
        }
        zenithEditor.setCode(text);
        showToast('Code pasted ✓');
        // Trigger unsaved dot
        const dot = document.querySelector('.dot-unsaved');
        if (dot) dot.classList.remove('hidden');
      } catch (err) {
        // Clipboard permission denied or not supported
        showToast('Cannot read clipboard — allow permission in browser settings');
      }
    });
  }

  if (btnMobileCopy) {
    btnMobileCopy.addEventListener('click', async () => {
      try {
        const code = zenithEditor.getCode();
        if (!code || !code.trim()) {
          showToast('Nothing to copy');
          return;
        }
        await navigator.clipboard.writeText(code);
        showToast('Code copied ✓');
      } catch (err) {
        // Fallback: select all and let user copy manually
        showToast('Auto-copy failed — select all and copy manually');
      }
    });
  }

}

// Extra running-state transition (stdout/stderr means actively running)
function onWorkerRuntimeMessage(e) {
  if (e.data.type === 'stdout' || e.data.type === 'stderr') {
    if (isRunning) setStatus('running');
  }
}

// ──────────────────────────────────────────────────────────────
// Kick it off
// ──────────────────────────────────────────────────────────────
// Guard against DOMContentLoaded already having fired (Monaco CDN loader
// is synchronous and may delay script execution past the event).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
