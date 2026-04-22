/**
 * terminal.js — Xterm.js initialization for Zenith C++
 * Provides a warm-dark terminal with helper write methods.
 */

class ZenithTerminal {
  constructor() {
    this.term = null;
    this.fitAddon = null;
    this._ready = false;
  }

  /** Initialize Xterm.js */
  init() {
    const container = document.getElementById('terminal-container');
    if (!container) return;

    this.term = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 13,
      lineHeight: 1.5,
      letterSpacing: 0.3,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      allowTransparency: true,
      scrollback: 10000,
      theme: {
        background:       '#141413',   // near-black
        foreground:       '#b0aea5',   // warm silver
        cursor:           '#c96442',   // terracotta
        cursorAccent:     '#141413',
        selectionBackground: 'rgba(201,100,66,0.18)',
        // ANSI — warm, no neon
        black:            '#1c1b19',
        red:              '#b53333',   // crimson
        green:            '#5a9e6f',   // muted sage
        yellow:           '#d4a017',   // warm gold
        blue:             '#3898ec',   // focus blue
        magenta:          '#c96442',   // terracotta
        cyan:             '#8fa8c8',   // dusty blue
        white:            '#b0aea5',   // warm silver
        brightBlack:      '#3d3d3a',
        brightRed:        '#c96442',
        brightGreen:      '#7aab8a',
        brightYellow:     '#e8b84b',
        brightBlue:       '#60a5fa',
        brightMagenta:    '#d97757',   // coral
        brightCyan:       '#a8bfd4',
        brightWhite:      '#faf9f5',   // ivory
      }
    });

    // Addons
    this.fitAddon = new FitAddon.FitAddon();
    this.term.loadAddon(this.fitAddon);

    if (typeof WebLinksAddon !== 'undefined') {
      this.term.loadAddon(new WebLinksAddon.WebLinksAddon());
    }

    this.term.open(container);
    this.fitAddon.fit();
    this._ready = true;

    // Resize observer
    const ro = new ResizeObserver(() => {
      try { this.fitAddon.fit(); } catch (_) {}
    });
    ro.observe(container);

    this._printBanner();
  }

  /** Print the startup banner */
  _printBanner() {
    const lines = [
      '',
      '\x1b[38;2;201;100;66m  ╔══════════════════════════════════════════╗\x1b[0m',
      '\x1b[38;2;201;100;66m  ║   \x1b[1;38;2;250;249;245mZenith C++ \x1b[0m\x1b[38;2;201;100;66m— Browser-Native IDE         ║\x1b[0m',
      '\x1b[38;2;201;100;66m  ║   \x1b[2mPowered by JSCPP / LLVM·Clang→Wasm      \x1b[38;2;201;100;66m║\x1b[0m',
      '\x1b[38;2;201;100;66m  ╚══════════════════════════════════════════╝\x1b[0m',
      '',
      `\x1b[2m  Press \x1b[0m\x1b[38;2;217;119;87mRun\x1b[0m\x1b[2m or \x1b[0m\x1b[38;2;217;119;87mCtrl+Enter\x1b[0m\x1b[2m to compile and execute.\x1b[0m`,
      '',
    ];
    lines.forEach(l => this.term.writeln(l));
  }

  /** Write a plain string (no newline) */
  write(text) {
    if (this.term) this.term.write(text);
  }

  /** Write a line */
  writeln(text) {
    if (this.term) this.term.writeln(text);
  }

  /** Write stdout (parchment color) */
  writeStdout(text) {
    if (!this.term) return;
    // ivory (#faf9f5)
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    lines.forEach((line, i) => {
      if (i < lines.length - 1) {
        this.term.writeln(`\x1b[38;2;250;249;245m${line}\x1b[0m`);
      } else if (line) {
        this.term.write(`\x1b[38;2;250;249;245m${line}\x1b[0m`);
      }
    });
  }

  writeStderr(text) {
    if (!this.term) return;
    // crimson (#b53333)
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    lines.forEach((line, i) => {
      if (i < lines.length - 1) {
        this.term.writeln(`\x1b[38;2;181;51;51m${line}\x1b[0m`);
      } else if (line) {
        this.term.write(`\x1b[38;2;181;51;51m${line}\x1b[0m`);
      }
    });
  }

  /** Write a system/info message (stone gray, dimmed) */
  writeInfo(text) {
    if (this.term) this.term.writeln(`\x1b[2;37m${text}\x1b[0m`);
  }

  /** Write a success message (neon green) */
  writeSuccess(text) {
    // muted sage green
    if (this.term) this.term.writeln(`\x1b[38;2;90;158;111m${text}\x1b[0m`);
  }

  writeWarn(text) {
    // warm gold
    if (this.term) this.term.writeln(`\x1b[38;2;212;160;23m${text}\x1b[0m`);
  }

  /** Write a separator line */
  writeSeparator() {
    if (this.term) {
      this.term.writeln(`\x1b[2m  ${'─'.repeat(48)}\x1b[0m`);
    }
  }

  /** Write a compile header with timestamp */
  writeCompileHeader() {
    const now = new Date();
    const ts = now.toLocaleTimeString('en-US', { hour12: false });
    this.term.writeln('');
    // Terracotta header
    this.term.writeln(`\x1b[2m  ┌─ \x1b[0m\x1b[38;2;201;100;66mCompiling\x1b[0m\x1b[2m ─── ${ts} ─────────────────────────\x1b[0m`);
  }

  writeRunResult(exitCode, durationMs) {
    const ok = exitCode === 0;
    // ok: sage green  err: crimson
    const color = ok ? '\x1b[38;2;90;158;111m' : '\x1b[38;2;181;51;51m';
    const icon  = ok ? '✓' : '✗';
    const label = ok ? 'Exited normally' : `Exited with code ${exitCode}`;
    const dur   = durationMs != null ? `  \x1b[2m(${durationMs}ms)\x1b[0m` : '';
    this.term.writeln('');
    this.term.writeln(`\x1b[2m  └─ \x1b[0m${color}${icon} ${label}\x1b[0m${dur}`);
    this.term.writeln('');
  }

  /**
   * Shown when the program needs stdin — prompts the user to type input.
   */
  writeStdinPrompt() {
    this.term.writeln('');
    this.term.writeln('\x1b[38;2;212;160;23m  ┌─ Program needs input ─────────────────────────────────\x1b[0m');
    this.term.writeln('\x1b[2m  │  Type each input value and press Enter.\x1b[0m');
    this.term.writeln('\x1b[2m  │  Press Enter twice (or Ctrl+D) when done.\x1b[0m');
    this.term.writeln('\x1b[38;2;212;160;23m  └──────────────────────────────────────────────────────\x1b[0m');
    this.term.writeln('');
    // Show the input prompt
    this.term.write('\x1b[38;2;201;100;66m  stdin \x1b[0m\x1b[38;2;250;249;245m▸\x1b[0m ');
  }

  /**
   * Shown on each subsequent line of input.
   */
  writeStdinContinue() {
    this.term.write('\x1b[38;2;201;100;66m         \x1b[0m\x1b[38;2;250;249;245m▸\x1b[0m ');
  }

  /**
   * Shown after stdin is collected, summarising what was sent.
   */
  writeStdinDone(stdinStr) {
    this.term.writeln('');
    const preview = stdinStr.trim().replace(/\n/g, ' ↵ ');
    this.term.writeln(`\x1b[2m  stdin: \x1b[0m\x1b[38;2;90;158;111m${preview || '(empty)'}\x1b[0m`);
    this.term.writeln('');
  }

  /** Clear the terminal */
  clear() {
    if (this.term) this.term.clear();
  }

  /** Fit terminal to container */
  fit() {
    if (this.fitAddon) {
      try { this.fitAddon.fit(); } catch (_) {}
    }
  }
}

// Export singleton
window.zenithTerminal = new ZenithTerminal();
