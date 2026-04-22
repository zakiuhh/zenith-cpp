/**
 * editor.js — Monaco Editor initialization for Zenith C++
 * Loads Monaco via AMD, applies custom dark theme, configures C++ language.
 */

const DEFAULT_CODE = `#include <iostream>
using namesapce std;
int main(){
    cout<<"Welcome to Zenith C++";
    return 0;
}`;

class ZenithEditor {
  constructor() {
    this.editor = null;
    this.monaco = null;
    this._onReady = [];
  }

  /**
   * Initialise Monaco via AMD loader.
   * @returns {Promise<void>}
   */
  init() {
    return new Promise((resolve, reject) => {
      require.config({
        paths: {
          vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs'
        }
      });

      require(['vs/editor/editor.main'], (monaco) => {
        this.monaco = monaco;
        this._registerTheme(monaco);
        this._registerCppCompletions(monaco);
        this._createEditor(monaco);
        resolve();
      });
    });
  }

  /** Register the Zenith dark theme */
  _registerTheme(monaco) {
    monaco.editor.defineTheme('zenith-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        // Claude warm-dark palette — earthy, readable, no neon
        { token: '',                  foreground: 'b0aea5', background: '1c1b19' },
        { token: 'comment',           foreground: '4a4845', fontStyle: 'italic' },
        { token: 'keyword',           foreground: 'd97757', fontStyle: '' },   // coral
        { token: 'keyword.control',   foreground: 'c96442' },                  // terracotta
        { token: 'string',            foreground: '7aab8a' },                  // muted sage
        { token: 'string.escape',     foreground: '5a9e6f' },
        { token: 'number',            foreground: 'd4a017' },                  // warm gold
        { token: 'number.float',      foreground: 'd4a017' },
        { token: 'type',              foreground: '8fa8c8' },                  // dusty blue
        { token: 'type.identifier',   foreground: '8fa8c8' },
        { token: 'delimiter',         foreground: '4a4845' },
        { token: 'delimiter.bracket', foreground: '6b6865' },
        { token: 'operator',          foreground: 'c96442' },                  // terracotta
        { token: 'identifier',        foreground: 'd0cdc8' },
        { token: 'function',          foreground: 'd97757' },                  // coral
        { token: 'variable',          foreground: 'faf9f5' },                  // ivory
        { token: 'macro',             foreground: 'a07840', fontStyle: 'bold' },
        { token: 'preprocessor',      foreground: 'a07840' },
        { token: 'namespace',         foreground: '8fa8c8' },
        { token: 'annotation',        foreground: 'c96442' },
      ],
      colors: {
        'editor.background':             '#1c1b19',
        'editor.foreground':             '#b0aea5',
        'editor.lineHighlightBackground':'#252422',
        'editor.lineHighlightBorder':    '#25242200',
        'editor.selectionBackground':    '#c9644228',
        'editor.selectionHighlightBackground': '#c9644215',
        'editor.findMatchBackground':    '#c9644235',
        'editor.findMatchHighlightBackground': '#c9644218',
        'editorCursor.foreground':       '#c96442',
        'editorCursor.background':       '#1c1b19',
        'editorLineNumber.foreground':   '#3a3835',
        'editorLineNumber.activeForeground': '#87867f',
        'editorIndentGuide.background':  '#252422',
        'editorIndentGuide.activeBackground': '#30302e',
        'editorWhitespace.foreground':   '#2a2826',
        'editorBracketMatch.background': '#c9644220',
        'editorBracketMatch.border':     '#c9644260',
        'editorGutter.background':       '#1c1b19',
        'editorSuggestWidget.background':'#252422',
        'editorSuggestWidget.border':    '#30302e',
        'editorSuggestWidget.foreground':'#b0aea5',
        'editorSuggestWidget.selectedBackground': '#c9644218',
        'editorSuggestWidget.highlightForeground': '#d97757',
        'editorHoverWidget.background':  '#252422',
        'editorHoverWidget.border':      '#30302e',
        'input.background':              '#30302e',
        'input.border':                  '#3d3d3a',
        'input.foreground':              '#faf9f5',
        'scrollbar.shadow':              '#00000000',
        'scrollbarSlider.background':    '#30302e66',
        'scrollbarSlider.hoverBackground':'#3d3d3a88',
        'scrollbarSlider.activeBackground':'#4a4845aa',
        'minimap.background':            '#1c1b19',
        'minimapSlider.background':      '#c9644215',
        'minimapSlider.hoverBackground': '#c9644225',
        'panel.background':              '#141413',
        'panel.border':                  '#30302e',
        'focusBorder':                   '#3898ec55',
        'selection.background':          '#c9644222',
      }
    });
  }

  /** Register C++ specific completions (basic snippets) */
  _registerCppCompletions(monaco) {
    monaco.languages.registerCompletionItemProvider('cpp', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const snippets = [
          {
            label: 'cout',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'std::cout << ${1:value} << "\\n";',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Print to stdout',
            range
          },
          {
            label: 'cin',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'std::cin >> ${1:var};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Read from stdin',
            range
          },
          {
            label: 'for',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t${3}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'C-style for loop',
            range
          },
          {
            label: 'foreach',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'for (const auto& ${1:item} : ${2:container}) {\n\t${3}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Range-based for loop',
            range
          },
          {
            label: 'vector',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'std::vector<${1:int}> ${2:v};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'std::vector declaration',
            range
          },
          {
            label: 'main',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'int main() {\n\t${1}\n\treturn 0;\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Main function',
            range
          },
          {
            label: 'include',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '#include <${1:iostream}>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Include header',
            range
          },
          {
            label: 'class',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class ${1:ClassName} {\npublic:\n\t${1:ClassName}() = default;\n\t~${1:ClassName}() = default;\n\nprivate:\n\t${2}\n};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Class definition',
            range
          },
          {
            label: 'lambda',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '[${1:&}](${2}) { ${3} }',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Lambda expression',
            range
          },
        ];

        return { suggestions: snippets };
      }
    });
  }

  /** Create the Monaco editor instance */
  _createEditor(monaco) {
    const container = document.getElementById('monaco-container');

    this.editor = monaco.editor.create(container, {
      value: DEFAULT_CODE,
      language: 'cpp',
      theme: 'zenith-dark',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontLigatures: true,
      lineHeight: 23,
      letterSpacing: 0.2,
      minimap: { enabled: true, scale: 1 },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      renderLineHighlight: 'all',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      cursorStyle: 'line',
      cursorWidth: 2,
      smoothScrolling: true,
      mouseWheelZoom: true,
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      suggest: { showIcons: true, showStatusBar: true, preview: true },
      formatOnPaste: true,
      renderWhitespace: 'selection',
      padding: { top: 18, bottom: 18 },
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        vertical: 'auto', horizontal: 'auto',
        verticalScrollbarSize: 5, horizontalScrollbarSize: 5,
      },
      automaticLayout: true,
    });

    // Cursor position in header
    this.editor.onDidChangeCursorPosition((e) => {
      const pos = e.position;
      const el = document.getElementById('cursor-pos');
      if (el) el.textContent = `Ln ${pos.lineNumber}, Col ${pos.column}`;
    });

    // Mark file as modified
    this.editor.onDidChangeModelContent(() => {
      const dot = document.querySelector('.dot-unsaved');
      if (dot) dot.classList.remove('hidden');
    });

    this._onReady.forEach(fn => fn(this.editor, monaco));
  }

  /** Get the current editor content */
  getCode() {
    return this.editor ? this.editor.getValue() : '';
  }

  /** Set editor content programmatically */
  setCode(code) {
    if (this.editor) {
      this.editor.setValue(code);
    }
  }

  /** Update font size */
  setFontSize(size) {
    if (this.editor) {
      this.editor.updateOptions({ fontSize: size });
    }
  }

  /** Update word wrap */
  setWordWrap(on) {
    if (this.editor) {
      this.editor.updateOptions({ wordWrap: on ? 'on' : 'off' });
    }
  }

  /** Register a callback to run when editor is ready */
  onReady(fn) {
    if (this.editor) {
      fn(this.editor, this.monaco);
    } else {
      this._onReady.push(fn);
    }
  }

  /** Resize editor (call after pane resize) */
  layout() {
    if (this.editor) this.editor.layout();
  }
}

// Export singleton
window.zenithEditor = new ZenithEditor();
