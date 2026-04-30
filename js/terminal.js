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

    const isLight = document.body.classList.contains('theme-light');

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
      theme: isLight ? this._lightTheme() : this._darkTheme(),
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

  /** Dark terminal palette */
  _darkTheme() {
    return {
      background:          '#141413',
      foreground:          '#b0aea5',
      cursor:              '#c96442',
      cursorAccent:        '#141413',
      selectionBackground: 'rgba(201,100,66,0.18)',
      black:               '#1c1b19',
      red:                 '#b53333',
      green:               '#5a9e6f',
      yellow:              '#d4a017',
      blue:                '#3898ec',
      magenta:             '#c96442',
      cyan:                '#8fa8c8',
      white:               '#b0aea5',
      brightBlack:         '#3d3d3a',
      brightRed:           '#c96442',
      brightGreen:         '#7aab8a',
      brightYellow:        '#e8b84b',
      brightBlue:          '#60a5fa',
      brightMagenta:       '#d97757',
      brightCyan:          '#a8bfd4',
      brightWhite:         '#faf9f5',
    };
  }

  /** Light terminal palette */
  _lightTheme() {
    return {
      background:          '#f5f4f0',
      foreground:          '#2a2825',
      cursor:              '#c96442',
      cursorAccent:        '#f5f4f0',
      selectionBackground: 'rgba(201,100,66,0.20)',
      black:               '#1a1916',
      red:                 '#a82020',
      green:               '#2e6b42',
      yellow:              '#7a5200',
      blue:                '#1a5fa8',
      magenta:             '#c96442',
      cyan:                '#2a5a80',
      white:               '#4a4844',
      brightBlack:         '#6b6963',
      brightRed:           '#c96442',
      brightGreen:         '#3d7a52',
      brightYellow:        '#9a6e00',
      brightBlue:          '#3a6da0',
      brightMagenta:       '#b54830',
      brightCyan:          '#3a6d90',
      brightWhite:         '#1a1916',
    };
  }

  /** Sync xterm theme + stdout color to match current UI theme */
  syncTheme() {
    if (!this.term) return;
    const isLight = document.body.classList.contains('theme-light');
    this.term.options.theme = isLight ? this._lightTheme() : this._darkTheme();
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

  /** Write stdout — color adapts to current UI theme */
  writeStdout(text) {
    if (!this.term) return;
    // Dark mode: ivory #faf9f5 | Light mode: near-black #1a1916
    const isLight = document.body.classList.contains('theme-light');
    const fg = isLight ? '\x1b[38;2;26;25;22m' : '\x1b[38;2;250;249;245m';
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    lines.forEach((line, i) => {
      if (i < lines.length - 1) {
        this.term.writeln(`${fg}${line}\x1b[0m`);
      } else if (line) {
        this.term.write(`${fg}${line}\x1b[0m`);
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
