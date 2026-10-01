/**
 * AlgoStudio Code Editor Service (Monaco Editor & Language Server Integration)
 */

let monacoEditor = null;
let monacoReady = false;
let pendingCodeToLoad = null;
let pythonFeaturesRegistered = false;
let lintTimeout = null;

function initEditor() {
  if (typeof require !== 'undefined' && require.config) {
    require.config({
      paths: {
        vs: 'vendor/monaco'
      }
    });

    window.MonacoEnvironment = {
      getWorkerUrl: function (workerId, label) {
        if (window.location.protocol === 'file:') {
          const blob = new Blob(['/* offline monaco worker */'], { type: 'application/javascript' });
          return URL.createObjectURL(blob);
        }
        const origin = window.location.origin || '';
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
          self.MonacoEnvironment = {
            baseUrl: '${origin}/vendor/monaco/'
          };
          importScripts('${origin}/vendor/monaco/editor/editor.worker.js');`
        )}`;
      }
    };

    require(['vs/editor/editor.main'], function () {
      setupMonacoEditor();
    });
  } else {
    setTimeout(initEditor, 100);
  }
}

function registerPythonLanguageFeatures() {
  if (pythonFeaturesRegistered || !window.monaco) return;
  pythonFeaturesRegistered = true;

  // 1. Python IntelliSense Autocompletion (Jedi)
  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '(', '[', '_'],
    provideCompletionItems: async function (model, position) {
      if (state.selectedLanguage !== 'python') return { suggestions: [] };
      try {
        const code = model.getValue();
        const res = await fetch('/api/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code,
            line: position.lineNumber,
            column: position.column - 1
          })
        });
        if (!res.ok) return { suggestions: [] };
        const data = await res.json();
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const kindMap = {
          2: monaco.languages.CompletionItemKind.Function,
          5: monaco.languages.CompletionItemKind.Variable,
          6: monaco.languages.CompletionItemKind.Class,
          8: monaco.languages.CompletionItemKind.Module,
          9: monaco.languages.CompletionItemKind.Property,
          13: monaco.languages.CompletionItemKind.Keyword,
          16: monaco.languages.CompletionItemKind.File,
        };

        const suggestions = (data.suggestions || []).map(s => ({
          label: s.label,
          kind: kindMap[s.kind] || monaco.languages.CompletionItemKind.Function,
          detail: s.detail || '',
          documentation: s.documentation ? { value: s.documentation } : undefined,
          insertText: s.insertText || s.label,
          range: range,
          sortText: s.label
        }));
        return { suggestions };
      } catch (err) {
        return { suggestions: [] };
      }
    }
  });

  // 2. Python Hover Provider (Docstrings & Signatures)
  monaco.languages.registerHoverProvider('python', {
    provideHover: async function (model, position) {
      if (state.selectedLanguage !== 'python') return null;
      try {
        const code = model.getValue();
        const res = await fetch('/api/hover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: code,
            line: position.lineNumber,
            column: position.column - 1
          })
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.contents || data.contents.length === 0) return null;
        return {
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          contents: data.contents
        };
      } catch (err) {
        return null;
      }
    }
  });

  // 3. Document Formatting Provider (Black)
  monaco.languages.registerDocumentFormattingEditProvider('python', {
    provideDocumentFormattingEdits: async function (model) {
      try {
        const code = model.getValue();
        const res = await fetch('/api/format', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code })
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (data.code && data.code !== code) {
          return [{
            range: model.getFullModelRange(),
            text: data.code
          }];
        }
      } catch (err) {
        console.error('Format failed:', err);
      }
      return [];
    }
  });
}

function scheduleLint() {
  if (state.selectedLanguage !== 'python' || !monacoEditor || !window.monaco) return;
  clearTimeout(lintTimeout);
  lintTimeout = setTimeout(async () => {
    const model = monacoEditor ? monacoEditor.getModel() : null;
    if (!model) return;
    const code = model.getValue();
    try {
      const res = await fetch('/api/lint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
      });
      if (!res.ok) return;
      const data = await res.json();
      const markers = (data.errors || []).map(err => {
        const lineMax = model.getLineMaxColumn(err.line) || (err.column + 2);
        return {
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: err.line,
          startColumn: Math.max(1, err.column),
          endLineNumber: err.line,
          endColumn: Math.max(err.column + 1, lineMax),
          message: err.message,
          source: 'Python Compiler (AST)'
        };
      });
      monaco.editor.setModelMarkers(model, 'python-compiler', markers);
    } catch (err) {
      // Ignore offline fetch errors
    }
  }, 400);
}

function mapToMonacoLanguage(lang) {
  switch (lang) {
    case 'python': return 'python';
    case 'cpp': return 'cpp';
    case 'java': return 'java';
    case 'typescript': return 'typescript';
    default: return 'python';
  }
}

function setupMonacoEditor() {
  const container = document.getElementById('monaco-editor-container');
  if (!container || !window.monaco) return;

  registerPythonLanguageFeatures();

  const isDark = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') !== 'light';

  monacoEditor = monaco.editor.create(container, {
    value: '',
    language: mapToMonacoLanguage(state.selectedLanguage),
    theme: isDark ? 'vs-dark' : 'vs',
    fontSize: 13,
    lineHeight: 21,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, Consolas, monospace",
    fontLigatures: true,
    automaticLayout: true,
    minimap: { enabled: true, maxColumn: 80 },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    tabSize: 4,
    insertSpaces: true,
    quickSuggestions: { other: true, comments: false, strings: true },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    wordBasedSuggestions: 'matchingDocuments',
    parameterHints: { enabled: true },
    folding: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    fixedOverflowWidgets: true,
  });

  monacoReady = true;

  // Keyboard Shortcut: Cmd+Enter / Ctrl+Enter
  monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
    runCode();
  });

  // Track code changes & schedule real-time linting
  monacoEditor.onDidChangeModelContent(() => {
    if (state.currentQuestion) {
      const key = `${state.currentQuestion.id}_${state.selectedLanguage}`;
      state.editorCodes[key] = monacoEditor.getValue();
    }
    scheduleLint();
  });

  if (pendingCodeToLoad !== null) {
    monacoEditor.setValue(pendingCodeToLoad);
    pendingCodeToLoad = null;
    scheduleLint();
  } else if (state.currentQuestion) {
    loadCodeForLanguage(state.selectedLanguage);
  }
}

function layoutEditor() {
  if (monacoEditor) {
    monacoEditor.layout();
  }
}

function syncEditorTheme(theme) {
  if (window.monaco && window.monaco.editor) {
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
  }
}

function getEditorCode() {
  return monacoEditor ? monacoEditor.getValue() : '';
}

function setEditorCode(code) {
  if (monacoEditor) {
    monacoEditor.setValue(code);
    scheduleLint();
  } else {
    pendingCodeToLoad = code;
  }
}

function onEditorLanguageChange(lang) {
  state.selectedLanguage = lang;
  if (monacoEditor) {
    const model = monacoEditor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, mapToMonacoLanguage(lang));
    }
  }
  loadCodeForLanguage(lang);
}

function loadCodeForLanguage(lang) {
  const q = state.currentQuestion;
  if (!q) return;

  const cacheKey = `${q.id}_${lang}`;
  let code = '';
  if (state.editorCodes[cacheKey]) {
    code = state.editorCodes[cacheKey];
  } else {
    const langData = q.language ? q.language[lang] : null;
    if (langData && langData.predefinedCode) {
      code = langData.predefinedCode.trim();
    } else if (langData && langData.solutionCode) {
      code = langData.solutionCode.trim();
    } else {
      code = `# Implement your solution for ${q.title} here\n`;
    }
  }

  const langSelect = document.getElementById('editor-lang-select');
  if (langSelect) langSelect.value = lang;

  if (monacoEditor) {
    const model = monacoEditor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, mapToMonacoLanguage(lang));
    }
    monacoEditor.setValue(code);
    scheduleLint();
  } else {
    pendingCodeToLoad = code;
  }
}

function resetStarterCode() {
  const q = state.currentQuestion;
  if (!q) return;
  const lang = state.selectedLanguage;
  const cacheKey = `${q.id}_${lang}`;
  delete state.editorCodes[cacheKey];
  loadCodeForLanguage(lang);
  showToast('Reset code to starter template.');
}

function loadSolutionIntoEditor() {
  const q = state.currentQuestion;
  if (!q || !q.language) return;
  const lang = state.selectedLanguage;
  const langData = q.language[lang];
  if (langData && langData.solutionCode) {
    const code = langData.solutionCode.trim();
    const cacheKey = `${q.id}_${lang}`;
    state.editorCodes[cacheKey] = code;
    setEditorCode(code);
    showToast(`Loaded official ${lang} solution into editor.`);
  } else {
    showToast(`No official solution available for ${lang}.`);
  }
}

function copySolutionCode() {
  const text = document.getElementById('solution-code-view')?.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    showToast('Solution code copied to clipboard!');
  });
}

function copyEditorCode() {
  const text = getEditorCode();
  navigator.clipboard.writeText(text).then(() => {
    showToast('Editor code copied to clipboard!');
  });
}

async function formatEditorCode() {
  if (!monacoEditor) return;
  if (state.selectedLanguage === 'python') {
    try {
      const code = monacoEditor.getValue();
      const res = await fetch('/api/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.code && data.code !== code) {
          monacoEditor.setValue(data.code);
          showToast('Code formatted with Black.');
          return;
        } else if (data.error) {
          showToast(`Formatting warning: ${data.error}`);
          return;
        }
      }
    } catch (err) {
      // Fallback to monaco action
    }
  }

  const formatAction = monacoEditor.getAction('editor.action.formatDocument');
  if (formatAction) {
    formatAction.run().then(() => {
      showToast('Code formatted.');
    });
  }
}
