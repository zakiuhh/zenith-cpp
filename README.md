<h1 align="center">ZENITH C++</h1>

<p align="center">
  <strong>Write C++. Compile. Run. All in the Browser.</strong><br/>
  A full-featured browser-native C++ IDE — compile and run C++ code entirely client-side, no server required.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-Client--Side-blueviolet?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Engine-JSCPP%20%2B%20Wasm-624DE3?style=for-the-badge&logo=webassembly" />
  <img src="https://img.shields.io/badge/Editor-Monaco-38B2AC?style=for-the-badge" />
  <br/><br/>
  <img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" />
  <img src="https://img.shields.io/badge/C%2B%2B-17-blue?style=flat-square&logo=cplusplus" />
  <img src="https://img.shields.io/badge/theme-dark%20%2B%20light-1e293b?style=flat-square" />
  <img src="https://img.shields.io/badge/powered%20by-WebAssembly-654ff0?style=flat-square&logo=webassembly" />
</p>

---

## 🎯 Overview

**Zenith C++** is a fully client-side C++ development environment that runs entirely in your browser. Using **JSCPP** (JavaScript C++ interpreter) as the primary execution engine and optional Clang/LLVM compiled to WebAssembly for advanced features, your code compiles and runs instantly — no backend, no round-trips, no install.

**Privacy-first**: Your code never leaves your machine. All compilation and execution happens locally via WebAssembly.

**Developer Experience**: Monaco Editor (VS Code engine) + Xterm.js terminal + Web Workers = seamless, responsive IDE.

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

## ✨ Key Features

### 🚀 Development Experience
- **Monaco Editor** — The same editor that powers VS Code, with full C++ IntelliSense, syntax highlighting, code completion, and keyboard shortcuts
- **Xterm.js Terminal** — Real terminal output with full ANSI color support for `stdout`/`stderr` and exit codes
- **Functions Panel** — Quick navigation to functions and classes in your code
- **Dual Theme Support** — Beautiful dark and light themes with warm, earthy color palettes

### ⚡ Performance & Architecture
- **JSCPP Interpreter** — Primary execution engine for instant compilation (milliseconds)
- **Web Worker Isolation** — Compiler runs on a separate thread, keeping the UI buttery smooth
- **Infinite Loop Protection** — Stop button terminates runaway code immediately
- **Local Storage Autosave** — Your work is automatically saved in the browser

### 🔒 Privacy & Offline
- **100% Client-Side** — Your code never touches a server. Everything runs in your browser
- **Offline-Capable** — Works fully offline once loaded
- **Zero Telemetry** — No tracking, no analytics, no data collection

### 🎛️ Customization
- **Compiler Flags** — Configure optimization levels and C++ standards (`-O2 -std=c++17` by default)
- **Editor Settings** — Adjust font size, word wrap, and more
- **Execution Timeout** — Configurable timeout (default 30s)
- **stdin Support** — Built-in stdin panel for interactive programs with `cin` auto-detection

### 📚 Extended Library Support
Polyfilled support for 40+ standard library headers:
```cpp
<iostream>  <vector>    <algorithm> <string>    <map>       <set>
<cmath>     <cstdlib>   <ctime>     <numeric>   <deque>     <queue>
<stack>     <bitset>    <regex>     <random>    <chrono>    <functional>
// ... and many more
```

---

## 🏗️ Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Editor** | Monaco Editor v0.47 | VS Code-powered code editor with IntelliSense |
| **Terminal** | Xterm.js v5 | ANSI-compatible terminal emulator |
| **Compiler** | JSCPP v2.0.9 | JavaScript C++ interpreter (primary engine) |
| **Advanced Compiler** | Clang/LLVM → Wasm | WebAssembly-compiled C++ compiler (optional) |
| **Styling** | Custom CSS | Hand-crafted dark + light themes, no frameworks |
| **Concurrency** | Web Workers | Background compilation without blocking UI |
| **Persistence** | LocalStorage | Auto-save code between sessions |
| **Security Headers** | COEP/COOP | Required for SharedArrayBuffer support |
| **Runtime** | Node.js 18+ / Bun | Development server with proper headers |
| **Deployment** | Vercel | Production hosting with security headers |

---

## 📁 Project Structure

```
zenith-cpp/
├── css/
│   ├── landing.css         # Landing page styles
│   └── style.css           # IDE and global styles
├── js/
│   ├── compiler-worker.js  # Web Worker: JSCPP engine, compilation, execution
│   ├── editor.js           # Monaco Editor initialization, themes, completions
│   ├── terminal.js         # Xterm.js config, stdout/stderr handling
│   ├── functions-panel.js  # Code navigation sidebar
│   ├── theme.js            # Dark/light theme switcher
│   ├── main.js             # App orchestrator, UI event wiring
│   ├── jscpp-entry.js      # JSCPP integration entry point
│   └── jscpp.bundle.js     # Bundled JSCPP runtime
├── index.html              # Landing page
├── compiler.html           # Main IDE interface
├── server.js               # Dev server with required COEP/COEP headers
├── vercel.json             # Vercel deployment config with security headers
├── package.json            # Dependencies (JSCPP)
└── README.md
```

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────┐
│             Main Thread (UI)                │
│                                             │
│  ┌──────────────┐      ┌─────────────┐      │
│  │   Monaco     │      │  Xterm.js   │      │
│  │   Editor     │      │  Terminal   │      │
│  └──────┬───────┘      └──────▲──────┘      │
│         │                     │             │
│         │  postMessage        │             │
│         ▼  (source code)      │             │
│  ┌─────────────────────────────────┐        │
│  │   Compiler Web Worker           │        │
│  │                                 │        │
│  │   ┌──────────────────────┐      │        │
│  │   │  JSCPP Interpreter   │      │        │
│  │   │  (Primary Engine)    │      │        │
│  │   └──────────┬───────────┘      │        │
│  │              │                  │        │
│  │              ▼                  │        │
│  │   ┌─────────────────────┐       │        │
│  │   │  Execute C++ Code   │       │        │
│  │   │  (stdout/stderr)    │       │        │
│  │   └──────────┬──────────┘       │        │
│  │              │                  │        │
│  └──────────────┼──────────────────┘        │
│                 │ postMessage (output)      │
│                 └─────────────────────────► │
└─────────────────────────────────────────────┘

Execution Flow:
1. User writes code in Monaco Editor
2. Clicks Run (or presses Ctrl+Enter)
3. Main thread posts code to Web Worker
4. JSCPP compiles & executes in worker thread
5. Output streams back to main thread
6. Xterm.js renders stdout/stderr in real-time
```

---

## 🚀 Getting Started

### Prerequisites

- **[Bun](https://bun.sh)** (recommended) or **Node.js v18+**

### Installation & Running Locally

```bash
# Clone the repository
git clone https://github.com/zakiuhh/zenith-cpp.git
cd zenith-cpp

# Install dependencies (only JSCPP)
bun install --force
# or: npm install

# Start the development server
bun run server.js
# or: node server.js
```

Then open **`http://localhost:3000`** in your browser.

### Available Scripts

```bash
# Start dev server (default port 3000)
bun start          # or: npm start

# Start dev server + open IDE automatically
bun run dev        # or: npm run dev

# Start on custom port
node server.js --port 8080
```

> **⚠️ Important**: You **must** run through the provided server (or any server that sets COEP/COOP headers). Opening `index.html` directly via `file://` will **not work** due to SharedArrayBuffer security requirements.

---

## 🔒 Cross-Origin Isolation (Required)

Zenith C++ uses **SharedArrayBuffer** for Wasm threading support, which requires the page to be **cross-origin isolated**. The following HTTP headers **must** be set on every response:

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

### Why These Headers?

- **SharedArrayBuffer** is a powerful browser API that enables true multi-threading in WebAssembly
- For security reasons, browsers require cross-origin isolation to use it
- Without these headers, the compiler will fail to initialize

### How It's Configured

✅ **Already configured in:**
- `server.js` — Development server (lines 23-27)
- `vercel.json` — Production deployment

If you deploy to a different host (Netlify, Cloudflare Pages, etc.), ensure your server sets these headers, or the compiler will not load.

---

## 🎨 Themes

Zenith C++ includes two carefully crafted themes:

- **🌙 Zenith Dark** — Warm, earthy dark theme with coral accents (default)
- **☀️ Zenith Light** — Clean light theme with terracotta highlights

Switch themes using the sun/moon icon in the navigation bar. Theme preference is saved to localStorage.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `Cmd+Enter` | Run code |
| `Esc` | Close settings panel |
| `Ctrl+/` | Toggle line comment |
| `Ctrl+D` | Select next occurrence |
| `Alt+↑↓` | Move line up/down |
| `Ctrl+Mouse Wheel` | Zoom editor font |

Plus all standard Monaco Editor shortcuts from VS Code!

---

## 💡 Usage Tips

### Writing Your First Program

1. Open **`compiler.html`** (or click "Launch IDE" from the landing page)
2. The editor comes pre-loaded with a "Hello, World!" example
3. Click **Run** or press **Ctrl+Enter**
4. Watch the output appear in the terminal below

### Working with stdin

If your program uses `cin` or `getline`, Zenith automatically detects it and shows the **stdin panel**:

```cpp
#include <iostream>
using namespace std;

int main() {
    string name;
    cout << "Enter your name: ";
    cin >> name;
    cout << "Hello, " << name << "!" << endl;
    return 0;
}
```

1. Click the **📝 stdin** button in the toolbar
2. Enter your input in the text area
3. Click **Run** — your input will be piped to the program

### Using Advanced Features

- **Settings Gear Icon**: Adjust compiler flags, font size, word wrap, execution timeout
- **Functions Panel (📋)**: Navigate to functions and classes in your code
- **Stop Button**: Terminate infinite loops or long-running programs
- **Theme Toggle**: Switch between dark and light themes

---

## 🚧 Limitations & Known Issues

- **JSCPP-based execution** is fast but has some limitations:
  - Not all C++17/20 features are supported
  - Template metaprogramming may not work
  - Some STL edge cases may behave differently
- **No multi-file support** (yet) — all code must be in a single file
- **No external libraries** — only standard library headers are available
- **Memory limits** — Large data structures may hit browser memory constraints

For production C++ development, use native compilers. Zenith is designed for learning, prototyping, and quick experiments.

---

## 🚀 Future Enhancements

We're constantly working to make Zenith C++ better! Here's what's on the roadmap:

### 📂 Multi-File Support
- **Project workspace** — Organize code into multiple files (headers + implementations)
- **File tree sidebar** — Browse and manage project files
- **Smart imports** — Auto-include headers from your project files
- **Build system** — Compile multi-file projects with dependency resolution

### 🎯 Advanced Features
- **Debugger integration** — Set breakpoints, step through code, inspect variables
- **Memory visualizer** — See stack/heap allocation in real-time
- **Performance profiler** — Identify bottlenecks with execution time analysis
- **Unit testing framework** — Built-in support for Catch2 or Google Test
- **Code linting** — Real-time suggestions with clang-tidy integration

### 🔧 Developer Tools
- **Git integration** — Clone repos, commit changes, push to GitHub directly from the IDE
- **Snippets library** — Save and share commonly-used code patterns
- **Code templates** — Quick-start templates for data structures, algorithms, design patterns
- **Collaboration mode** — Real-time code sharing with peers (like Google Docs for C++)
- **Export options** — Download project as .zip or push to GitHub Gist

### 📚 Learning & Education
- **Interactive tutorials** — Step-by-step C++ lessons with instant feedback
- **Algorithm visualizer** — Visualize sorting, searching, and graph algorithms
- **Competitive programming mode** — LeetCode/Codeforces-style problem solving with test cases
- **Code challenges** — Daily/weekly coding challenges with leaderboards
- **Syntax reference** — Built-in C++ documentation and cheat sheets

### 🎨 UI/UX Improvements
- **More themes** — Additional color schemes (Nord, Dracula, Solarized, One Dark Pro)
- **Custom keybindings** — Vim/Emacs mode support
- **Split editor view** — Side-by-side code comparison or multi-file editing
- **Minimap enhancements** — Code structure overview with collapsible regions
- **Mobile optimization** — Better touch controls and layout for tablets

### ⚡ Performance & Compiler
- **Full Clang/LLVM Wasm** — Switch to production-grade Clang compilation for 100% C++17/20 support
- **C++20 features** — Concepts, ranges, coroutines, modules
- **Optimization levels** — Visual comparison of -O0, -O1, -O2, -O3 output
- **Assembly view** — See generated assembly code (x86-64/ARM)
- **WebGPU support** — GPU-accelerated compute shaders in C++

### 🌐 Community & Sharing
- **Code playground** — Share code snippets with unique URLs (like CodePen/JSFiddle)
- **Gallery showcase** — Browse and learn from community projects
- **Code reviews** — Request feedback from the community
- **Upvote/comments** — Engage with shared projects
- **Fork & remix** — Clone and modify shared code

### 🔌 Extensions & Integrations
- **Plugin API** — Allow community-built extensions
- **Language support** — Add C, Rust, Go interpreters
- **External APIs** — Fetch data from REST APIs for practice projects
- **Cloud storage** — Sync projects with Google Drive/Dropbox
- **VS Code sync** — Import/export VS Code settings and themes

### 🛠️ Advanced Compiler Features
- **Warning configuration** — Fine-tune compiler warnings
- **Static analysis** — Detect memory leaks, undefined behavior, security issues
- **Code formatting** — Auto-format with clang-format
- **Refactoring tools** — Rename symbols, extract functions, inline variables
- **AST viewer** — Visualize abstract syntax tree

---

### 💬 Want to see a feature?

Have an idea for Zenith C++? We'd love to hear it!

- **📝 Open an issue** on [GitHub Issues](https://github.com/zakiuhh/zenith-cpp/issues)
- **💡 Start a discussion** on [GitHub Discussions](https://github.com/zakiuhh/zenith-cpp/discussions)
- **⭐ Vote on features** — React with 👍 on existing feature requests

The features with the most community interest will be prioritized!

---

### Development Workflow

```bash
# Fork the repo and clone your fork
git clone https://github.com/YOUR_USERNAME/zenith-cpp.git
cd zenith-cpp

# Install dependencies
bun install

# Start dev server
bun run server.js

# Make your changes and test locally
# Push to your fork and open a PR
```

---

## 📄 License

**MIT License** — do whatever you want with it.

```
Copyright (c) 2026 Zaki Ul Hassan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- **[JSCPP](https://github.com/felixhao28/JSCPP)** — JavaScript C++ interpreter
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** — VS Code's editor engine
- **[Xterm.js](https://xtermjs.org/)** — Terminal emulator for the web
- **[Emscripten](https://emscripten.org/)** — Toolchain for compiling to WebAssembly
- **[Clang/LLVM](https://clang.llvm.org/)** — C++ compiler infrastructure

---

## 📬 Contact & Links

- **🌐 Live Demo**: [zenith-cpp.vercel.app](https://zenith-cpp.vercel.app)
- **💻 GitHub**: [github.com/zakiuhh/zenith-cpp](https://github.com/zakiuhh/zenith-cpp)
- **👤 Developer**: [Zaki Ul Hassan](https://github.com/zakiuhh)

---

<p align="center">
  <strong>Made with ❤️ by <a href="https://github.com/zakiuhh">Zaki</a></strong><br/>
  <em>Bringing native-quality C++ development to the browser</em>
</p>

<p align="center">
  <a href="#-overview">Back to Top ↑</a>
</p>