// jscpp-entry.js — entrypoint for bun build
// Exposes JSCPP as a global so the Web Worker can use it via importScripts.
import JSCPP from 'JSCPP';
self.JSCPP = JSCPP;
