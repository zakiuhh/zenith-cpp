/**
 * theme.js — Zenith C++ Shared Theme Switcher
 * Shared across compiler.html and index.html.
 * Reads/writes localStorage key 'zenith-theme'.
 * Applies body.theme-light or body.theme-dark on every page load.
 */

(function () {
  'use strict';

  const LS_THEME_KEY = 'zenith-theme';

  /** Apply the given theme ('dark' | 'light') to <body> */
  function applyTheme(theme) {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');

    // Update every theme-toggle button icon on the page
    document.querySelectorAll('.btn-theme').forEach(btn => {
      const icon = btn.querySelector('.theme-icon');
      const label = btn.querySelector('.theme-label');
      if (icon) icon.innerHTML = theme === 'light' ? moonSVG() : sunSVG();
      if (label) label.textContent = theme === 'light' ? 'Dark' : 'Light';
      btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
      btn.setAttribute('title',      theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    });

    // Sync Monaco editor theme if the editor is already initialised
    if (window.zenithEditor && typeof window.zenithEditor.syncTheme === 'function') {
      window.zenithEditor.syncTheme();
    }
    // Sync xterm.js terminal palette
    if (window.zenithTerminal && typeof window.zenithTerminal.syncTheme === 'function') {
      window.zenithTerminal.syncTheme();
    }
  }

  /** Toggle between dark and light, persist choice */
  function toggleTheme() {
    const current = localStorage.getItem(LS_THEME_KEY) || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(LS_THEME_KEY, next); } catch {}
    applyTheme(next);
  }

  /** Sun icon SVG (shown in dark mode — click to go light) */
  function sunSVG() {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2"  x2="12" y2="5"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="2"  y1="12" x2="5"  y2="12"/>
      <line x1="19" y1="12" x2="22" y2="12"/>
      <line x1="4.22"  y1="4.22"  x2="6.34"  y2="6.34"/>
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
      <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66"/>
      <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22"/>
    </svg>`;
  }

  /** Moon icon SVG (shown in light mode — click to go dark) */
  function moonSVG() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/>
    </svg>`;
  }

  /** Boot: apply persisted theme immediately (before paint) */
  function boot() {
    const saved = (() => { try { return localStorage.getItem(LS_THEME_KEY); } catch { return null; } })();
    applyTheme(saved || 'dark');
  }

  /** Wire up all .btn-theme buttons once DOM is ready */
  function wireButtons() {
    document.querySelectorAll('.btn-theme').forEach(btn => {
      btn.addEventListener('click', toggleTheme);
    });
  }

  // Run immediately for flash-of-wrong-theme prevention
  boot();

  // Wire buttons once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireButtons);
  } else {
    wireButtons();
  }

  // Expose globally for programmatic use
  window.zenithTheme = { toggle: toggleTheme, apply: applyTheme };
})();
