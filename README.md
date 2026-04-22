<h1 align="center">ZENITH C++</h1>

<p align="center">A browser-native C++ IDE — compile and run C++ code entirely client-side, no server required.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-Serverless-blueviolet?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Engine-WebAssembly-624DE3?style=for-the-badge&logo=webassembly" />
  <img src="https://img.shields.io/badge/Styles-Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css" />
  <br/><br/>
  <img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" />
  <img src="https://img.shields.io/badge/theme-dark-1e293b?style=flat-square" />
  <img src="https://img.shields.io/badge/powered%20by-WebAssembly-654ff0?style=flat-square&logo=webassembly" />
</p>

---

## Overview

Zenith C++ is a fully client-side C++ compiler and execution environment that runs entirely in the browser. It uses Clang/LLVM compiled to WebAssembly as its compilation engine — meaning your code never leaves your machine. Zero backend, zero round-trips.

---

## Screenshots

<h4 align="center"> Desktop View </h4>
<p align="center">
  <img width="75%" alt="Zenith C++ Desktop View 1" src="https://github.com/user-attachments/assets/4c24cd47-a95f-4018-b79f-44e2fbb95ddb" />
</p>
<p align="center">
  <img width="75%" alt="Zenith C++ Desktop View 2" src="https://github.com/user-attachments/assets/bab09f92-7aa8-4a9e-ba87-9b9695e56f7a" />
</p>

<h4 align="center"> Mobile View </h4>
<p align="center">
  <img width="30%" alt="Zenith C++ Mobile View 1" src="https://github.com/user-attachments/assets/381593ab-6a0e-4eb2-aee9-3724680ac6d0" />
  &nbsp;&nbsp;
  <img width="30%" alt="Zenith C++ Mobile View 2" src="https://github.com/user-attachments/assets/4162a976-1aee-423b-8a64-ce73347c5e61" />
</p>


---

## Features

- **In-browser compilation** via Clang/LLVM ported to WebAssembly
- **Monaco Editor** (the VS Code engine) with C++ syntax highlighting and IntelliSense
- **Xterm.js terminal** for realistic `stdout`/`stderr` output
- **Web Worker isolation** — the compiler runs on a separate thread, keeping the UI responsive
- **IndexedDB caching** — the ~30MB Wasm binary is cached locally after the first load
- **Virtual File System** via Emscripten's `MEMFS` — simulates a local compile environment entirely in memory
- **Infinite loop protection** via a Stop button that terminates the worker
- **Minimalist dark UI** — deep slate background, neon green accents, electric blue highlights

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI & Styling | HTML5, Tailwind CSS |
| Code Editor | Monaco Editor |
| Compilation Engine | `cpp-wasm` / `wasm-clang` (Clang/LLVM → Wasm) |
| Terminal | Xterm.js |
| Concurrency | Web Workers |
| Persistence | IndexedDB |
| Runtime | Emscripten MEMFS (Virtual FS) |
| Deployment | Vercel |
---

## Project Structure

```
zenith-cpp/
├── css/
│   ├── landing.css         # Landing page styles
│   └── style.css           # Global styles
├── js/
│   ├── compiler-worker.js  # Web Worker: loads Wasm binary, runs compilation
│   ├── editor.js           # Monaco Editor init, C++ theme, code extraction
│   ├── terminal.js         # Xterm.js config, stdout/stderr piping
│   ├── jscpp-entry.js      # JSCPP integration entry point
│   ├── jscpp.bundle.js     # Bundled JSCPP runtime
│   └── main.js             # App bootstrap and event wiring
├── index.html              # Main IDE layout (editor + terminal split)
├── compiler.html           # Compiler-specific view
├── server.js               # Dev server with required COOP/COEP headers
├── vercel.json             # Vercel deployment config with security headers
├── package.json
└── README.md
```

---

## Architecture

```
Main Thread
├── Monaco Editor  (code input)
└── Xterm.js       (output display)
        │ postMessage (source code)
        ▼
Compiler Web Worker
└── Clang Wasm Binary
    └── Emscripten MEMFS (Virtual FS)
        ├── writes  → input.cpp
        ├── compiles → output.wasm
        └── executes → stdout / stderr
        │ postMessage (output)
        ▼
Main Thread → Xterm.js renders result
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (or Node.js v18+)

### Install & Run

```bash
git clone https://github.com/your-username/zenith-cpp.git
cd zenith-cpp
bun install
bun run server.js
```

Then open `http://localhost:3000`.

> **Note:** You must run through the provided server (or any server that sets the required headers below). Opening `index.html` directly via `file://` will not work.

---

## Cross-Origin Isolation (Required)

Zenith C++ uses `SharedArrayBuffer` for Wasm threading, which requires the page to be cross-origin isolated. The following HTTP headers **must** be set on every response:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

These are already configured in `server.js` and `vercel.json`. If you deploy to a different host, make sure your server sets these headers or the compiler will not initialize.

---

## How the Wasm Binary is Cached

On first load, the Clang Wasm binary (~30MB) is fetched from the network and stored in **IndexedDB**. On every subsequent visit, it's loaded directly from the local cache — making cold starts fast and completely offline-capable after the first load.

---

## License

MIT — do whatever you want with it.
