/**
 * AlgoStudio Client State & Utilities
 */

const state = {
  questionsIndex: [],
  currentQuestion: null,
  selectedLanguage: 'python',
  solutionLanguage: 'python',
  activeTab: 'tab-description',
  activeResultCase: 0,
  lastRunResult: null,
  editorCodes: {} // Cache edits by `${qid}_${lang}`
};

function getHashParam(key) {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get(key);
}

function setHashParam(key, value) {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  params.set(key, value);
  window.history.replaceState(null, null, `#${params.toString()}`);
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCompanyName(name) {
  if (!name) return 'General';
  const map = {
    'APPLE': 'Apple',
    'OPENAI': 'OpenAI',
    'ANTHROPIC': 'Anthropic',
    'GOOGLE': 'Google',
    'META': 'Meta',
    'AMAZON': 'Amazon',
    'MICROSOFT': 'Microsoft'
  };
  return map[name.toUpperCase()] || name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatTag(tag) {
  if (!tag) return '';
  return tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
/**
 * Lightweight Markdown & LaTeX Math Parser
 */

function parseMarkdown(md) {
  if (!md) return '';

  let html = md;

  // 1. Remove delimiter
  html = html.replace(/<!--\s*###PREMIUM_CONTENT_DELIMITER###\s*-->/g, '');

  // 2. Escape standard characters but preserve math
  html = escapeHtml(html);

  // 3. LaTeX Math formatting: $$ formula $$ or $$formula$$
  html = html.replace(/\$\$([^\$]+)\$\$/g, (m, formula) => {
    return `<span class="math-formula">${formula.trim()}</span>`;
  });

  // 4. Code Blocks
  html = html.replace(/```([a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g, (m, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // 5. Inline Code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 6. Headings
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 7. Bold and Italic
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

  // 8. Blockquotes
  html = html.replace(/^>\s?(.*$)/gim, '<blockquote>$1</blockquote>');

  // 9. Unordered Lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\n)?)+/g, '<ul>$&</ul>');

  // 10. Ordered Lists
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

  // 11. Paragraphs (split by double newline)
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<ul') || p.startsWith('<blockquote')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}
/**
 * AlgoStudio Question Storage Client Service
 */

const storageService = {
  async listQuestions() {
    const res = await fetch('/api/questions');
    if (!res.ok) throw new Error('Failed to fetch questions');
    return await res.json();
  },

  async getQuestion(id) {
    const res = await fetch(`/api/question?id=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Question ${id} not found`);
    return await res.json();
  },

  async createQuestion(questionData) {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create question');
    return data;
  },

  async updateQuestion(id, questionData) {
    const payload = { ...questionData, id: id };
    const res = await fetch('/api/questions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update question');
    return data;
  },

  async deleteQuestion(id) {
    const res = await fetch(`/api/questions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete question');
    return data;
  },

};
/**
 * AlgoStudio UI Utilities & Interaction Handlers
 */

function initTheme() {
  const saved = localStorage.getItem('algostudio_theme') || 'dark';
  setTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

function setTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  }
  localStorage.setItem('algostudio_theme', theme);
  if (typeof syncEditorTheme === 'function') {
    syncEditorTheme(theme);
  }
}

function initSplitter() {
  const splitter = document.getElementById('splitter');
  const leftPane = document.getElementById('left-pane');
  if (!splitter || !leftPane) return;
  let isDragging = false;

  splitter.addEventListener('mousedown', (e) => {
    isDragging = true;
    splitter.classList.add('active');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const containerWidth = window.innerWidth;
    const newWidth = (e.clientX / containerWidth) * 100;
    if (newWidth >= 25 && newWidth <= 75) {
      leftPane.style.width = `${newWidth}%`;
      if (typeof layoutEditor === 'function') {
        layoutEditor();
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      splitter.classList.remove('active');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (typeof layoutEditor === 'function') {
        layoutEditor();
      }
    }
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.content-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.content-body .tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

function openExplorer() {
  const modal = document.getElementById('explorer-modal');
  if (modal) modal.classList.add('open');
}

function closeExplorer(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('btn-icon')) return;
  const modal = document.getElementById('explorer-modal');
  if (modal) modal.classList.remove('open');
}

function toggleHint(btn) {
  const card = btn.closest('.hint-card');
  if (card) card.classList.toggle('open');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}
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
/**
 * AlgoStudio Code Runner & Test Evaluation Client
 */

async function runCode() {
  const q = state.currentQuestion;
  if (!q) return;

  const btnRun = document.getElementById('btn-run');
  const summaryElem = document.getElementById('runner-summary-status');
  const code = getEditorCode();

  btnRun.disabled = true;
  btnRun.innerHTML = `<span class="pulse-dot" style="display:inline-block;"></span> Running...`;
  summaryElem.innerHTML = `<span style="color:var(--primary)">Executing test cases offline...</span>`;

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code,
        testCases: q.testCases || [],
        definition: q.definition || {}
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    state.lastRunResult = data;
    displayRunResults(data);
  } catch (err) {
    console.warn('Backend /api/run execution issue:', err);
    summaryElem.innerHTML = `<span style="color:var(--warning)">Note: Run <code>python3 app.py</code> to execute code locally.</span>`;
    showToast('Start local server: python3 app.py to execute code.');
  } finally {
    btnRun.disabled = false;
    btnRun.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Code`;
  }
}

function displayRunResults(data) {
  const drawer = document.getElementById('results-drawer');
  const summaryElem = document.getElementById('runner-summary-status');
  const tabsContainer = document.getElementById('results-tabs');
  const detailContainer = document.getElementById('results-detail-content');

  drawer.classList.add('open');
  tabsContainer.innerHTML = '';

  if (data.error && (!data.results || data.results.length === 0)) {
    summaryElem.innerHTML = `<span style="color:var(--danger)">Error: Execution Failed</span>`;
    detailContainer.innerHTML = `
      <div style="background:var(--danger-bg); border:1px solid var(--danger); padding:12px; border-radius:var(--radius-md); color:var(--danger-text); font-family:var(--font-mono); font-size:12px; white-space:pre-wrap;">
        ${escapeHtml(data.error)}
      </div>
    `;
    return;
  }

  const allPassed = data.allPassed;
  const statusColor = allPassed ? 'var(--success)' : 'var(--danger)';
  const statusText = allPassed ? `All Passed (${data.passed}/${data.total})` : `${data.passed}/${data.total} Passed`;
  const timeText = data.totalTimeMs ? `in ${data.totalTimeMs}ms` : '';

  summaryElem.innerHTML = `<strong style="color:${statusColor}">● ${statusText}</strong> <span class="text-muted">${timeText}</span>`;

  // Create result tabs
  (data.results || []).forEach((r, idx) => {
    const chip = document.createElement('button');
    chip.className = `res-tab-chip ${r.passed ? 'passed' : 'failed'} ${idx === 0 ? 'active' : ''}`;
    chip.textContent = `Case ${r.case} ${r.passed ? '✓' : '✗'}`;
    chip.onclick = () => selectResultCase(idx);
    tabsContainer.appendChild(chip);
  });

  selectResultCase(0);
}

function selectResultCase(index) {
  state.activeResultCase = index;
  const results = state.lastRunResult?.results || [];
  const r = results[index];
  if (!r) return;

  document.querySelectorAll('#results-tabs .res-tab-chip').forEach((c, idx) => {
    c.classList.toggle('active', idx === index);
  });

  const detailContainer = document.getElementById('results-detail-content');
  detailContainer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="badge ${r.passed ? 'badge-difficulty easy' : 'badge-difficulty hard'}">${r.passed ? 'PASSED' : 'FAILED'}</span>
        <span style="font-size:13px; font-weight:600;">Test Case ${r.case}</span>
      </div>
      <span style="font-size:12px; font-family:var(--font-mono); color:var(--text-muted);">${r.durationMs ? `${r.durationMs}ms` : ''}</span>
    </div>

    <div>
      <div class="field-label">Input Parameters</div>
      <div class="field-box">${escapeHtml(JSON.stringify(r.input || []))}</div>
    </div>

    <div>
      <div class="field-label">Expected Output</div>
      <div class="field-box" style="color:var(--success);">${escapeHtml(JSON.stringify(r.expected))}</div>
    </div>

    <div>
      <div class="field-label">Actual Returned Output</div>
      <div class="field-box" style="color:${r.passed ? 'var(--success)' : 'var(--danger)'};">${escapeHtml(JSON.stringify(r.actual))}</div>
    </div>

    ${r.error ? `
      <div>
        <div class="field-label" style="color:var(--danger);">Error Traceback</div>
        <div class="field-box" style="color:var(--danger);">${escapeHtml(r.error)}</div>
      </div>
    ` : ''}
  `;
}

function closeResultsDrawer() {
  const drawer = document.getElementById('results-drawer');
  if (drawer) drawer.classList.remove('open');
}
/**
 * AlgoStudio Question Catalog & Renderer
 */

async function loadQuestionsIndex() {
  try {
    const res = await fetch('/api/questions');
    if (!res.ok) throw new Error('API failed');
    state.questionsIndex = await res.json();
  } catch (err) {
    try {
      const res = await fetch('data/index.json');
      if (!res.ok) throw new Error('data/index.json missing');
      state.questionsIndex = await res.json();
    } catch (e2) {
      try {
        const res = await fetch('sample_data/index.json');
        if (!res.ok) throw new Error('sample_data/index.json missing');
        state.questionsIndex = await res.json();
      } catch (e3) {
        if (window.OFFLINE_BUNDLE && window.OFFLINE_BUNDLE.index) {
          state.questionsIndex = window.OFFLINE_BUNDLE.index;
        } else {
          console.error('Failed to load questions index:', e3);
          showToast('Could not load questions index.');
          return;
        }
      }
    }
  }

  populateQuickSelect();
  populateExplorerTable(state.questionsIndex);
  populateExplorerFilters();
  const countElem = document.getElementById('total-questions-count');
  if (countElem) countElem.textContent = state.questionsIndex.length;
}

async function loadQuestionById(qid) {
  try {
    const res = await fetch(`/api/question?id=${qid}`);
    if (!res.ok) throw new Error('API failed');
    const qData = await res.json();
    setQuestion(qData);
  } catch (err) {
    try {
      const res = await fetch(`data/questions/${qid}.json`);
      if (!res.ok) throw new Error('File failed');
      const qData = await res.json();
      setQuestion(qData);
    } catch (e2) {
      try {
        const res = await fetch(`sample_data/questions/${qid}.json`);
        if (!res.ok) throw new Error('Sample failed');
        const qData = await res.json();
        setQuestion(qData);
      } catch (e3) {
        if (window.OFFLINE_BUNDLE && window.OFFLINE_BUNDLE.questions && window.OFFLINE_BUNDLE.questions[qid]) {
          setQuestion(window.OFFLINE_BUNDLE.questions[qid]);
        } else {
          showToast(`Could not load question: ${qid}`);
        }
      }
    }
  }
}

function setQuestion(q) {
  state.currentQuestion = q;
  setHashParam('q', q.id);

  // Update quick selector
  const quickSelect = document.getElementById('quick-question-select');
  if (quickSelect) quickSelect.value = q.id;

  // Update Header & Breadcrumbs
  document.getElementById('p-title').textContent = q.title || 'Untitled';
  document.getElementById('nav-question-title').textContent = q.title || 'Untitled';

  // Company Name
  const companies = Object.keys(q.company || {}).filter(k => q.company[k] !== null);
  const primaryCompany = companies.length > 0 ? formatCompanyName(companies[0]) : (q.companyName || 'General');
  const companyFreq = companies.length > 0 && q.company[companies[0]] ? q.company[companies[0]].frequency : null;
  document.getElementById('nav-company-name').textContent = primaryCompany;
  document.getElementById('p-company').textContent = companyFreq ? `${primaryCompany} (${companyFreq})` : primaryCompany;

  // Difficulty badge
  const diffElem = document.getElementById('p-diff');
  diffElem.textContent = q.difficultyLabel || 'Medium';
  diffElem.className = `badge badge-difficulty ${(q.difficultyLabel || 'medium').toLowerCase()}`;

  // Stage
  const stageElem = document.getElementById('p-stage');
  stageElem.textContent = (q.stages && q.stages.length > 0) ? q.stages.join(', ') : 'OA';

  // Algorithm Tags
  const tagsElem = document.getElementById('p-tags');
  tagsElem.innerHTML = '';
  const tagsList = q.tags || q.algorithmTags || [];
  tagsList.forEach(t => {
    const span = document.createElement('span');
    span.className = 'tag-pill';
    span.textContent = formatTag(t);
    tagsElem.appendChild(span);
  });

  // Stats
  const statsElem = document.getElementById('p-stats');
  if (q.stats && q.stats.totalExecutions) {
    const rate = ((q.stats.acceptedExecutions / q.stats.totalExecutions) * 100).toFixed(1);
    statsElem.textContent = `Acceptance: ${rate}%`;
    statsElem.style.display = 'block';
  } else if (q.stats && q.stats.acceptance) {
    statsElem.textContent = `Acceptance: ${q.stats.acceptance}`;
    statsElem.style.display = 'block';
  } else {
    statsElem.style.display = 'none';
  }

  // Render Description
  renderDescription(q.description || '');

  // Render Editorial & Solutions
  renderEditorial(q);

  // Render Insights & Hints
  renderInsights(q.insights || { hints: q.hints || [] });

  // Render Test Cases
  renderTestCases(q.testCases || []);

  // Update Editor with language starter code or cached edits
  loadCodeForLanguage(state.selectedLanguage);

  // Reset Results Drawer
  closeResultsDrawer();
  document.getElementById('runner-summary-status').innerHTML = '<span class="text-muted">Click "Run Code" to test against test cases</span>';

  // Document Title
  document.title = `${q.title} | AlgoStudio Offline`;
}

function renderDescription(markdownText) {
  const container = document.getElementById('desc-rendered');
  if (!markdownText) {
    container.innerHTML = '<p class="text-muted">No description available for this question.</p>';
    return;
  }
  container.innerHTML = parseMarkdown(markdownText);
}

function renderEditorial(q) {
  const explContainer = document.getElementById('editorial-explanation');
  const badge = document.getElementById('tab-editorial-badge');
  const editorialText = q.editorial || q.explanation || '';
  const hasExpl = Boolean(editorialText && editorialText.trim());
  const hasLang = Boolean(q.language && Object.keys(q.language).length > 0);

  if (hasExpl || hasLang) {
    badge.textContent = 'Available';
    badge.className = 'pill-badge';
  } else {
    badge.textContent = 'None';
    badge.className = 'pill-badge';
  }

  if (hasExpl) {
    explContainer.innerHTML = parseMarkdown(editorialText);
  } else {
    explContainer.innerHTML = '<p class="text-muted">Editorial explanation has not been published yet for this question.</p>';
  }

  updateSolutionCodeDisplay();
}

function updateSolutionCodeDisplay() {
  const q = state.currentQuestion;
  const codeElem = document.getElementById('solution-code-view');
  if (!q || !q.language) {
    codeElem.textContent = '// No solution code available';
    return;
  }

  const langData = q.language[state.solutionLanguage];
  if (langData && langData.solutionCode) {
    codeElem.textContent = langData.solutionCode.trim();
  } else {
    codeElem.textContent = `// Solution for ${state.solutionLanguage} not provided.`;
  }
}

function switchSolutionLang(lang) {
  state.solutionLanguage = lang;
  document.querySelectorAll('#solution-lang-tabs .lang-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  updateSolutionCodeDisplay();
}

function renderInsights(insights) {
  const container = document.getElementById('insights-body');
  container.innerHTML = '';

  const hintsBadge = document.getElementById('tab-hints-badge');
  const hints = insights.hints || [];
  hintsBadge.textContent = `${hints.length} Hint${hints.length === 1 ? '' : 's'}`;

  // Quick Summary
  if (insights.quickSummary && insights.quickSummary.length > 0) {
    const card = document.createElement('div');
    card.className = 'insight-card';
    card.innerHTML = `<h4>Quick Summary</h4><p>${escapeHtml(insights.quickSummary)}</p>`;
    container.appendChild(card);
  }

  // Common Patterns
  if (insights.commonPatterns && insights.commonPatterns.length > 0) {
    const card = document.createElement('div');
    card.className = 'insight-card';
    const listHtml = insights.commonPatterns.map(p => `<li>${escapeHtml(p)}</li>`).join('');
    card.innerHTML = `<h4>Common Patterns</h4><ul>${listHtml}</ul>`;
    container.appendChild(card);
  }

  // Collapsible Hints
  if (hints.length > 0) {
    const hintsSection = document.createElement('div');
    hintsSection.innerHTML = '<h3 style="margin:16px 0 12px 0;">Hints</h3>';

    hints.forEach((h, idx) => {
      const hintText = typeof h === 'string' ? h : (h.content || h.text || '');
      const hintCard = document.createElement('div');
      hintCard.className = 'hint-card';
      hintCard.innerHTML = `
        <button class="hint-toggle" onclick="toggleHint(this)">
          <span>Hint ${idx + 1}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="hint-content">
          ${parseMarkdown(hintText)}
        </div>
      `;
      hintsSection.appendChild(hintCard);
    });

    container.appendChild(hintsSection);
  }
}

function renderTestCases(testCases) {
  const container = document.getElementById('testcases-list');
  const badge = document.getElementById('tab-tests-badge');
  container.innerHTML = '';

  const count = testCases ? testCases.length : 0;
  badge.textContent = `${count} Case${count === 1 ? '' : 's'}`;

  if (!testCases || testCases.length === 0) {
    container.innerHTML = '<p class="text-muted">No explicit test cases provided for this question.</p>';
    return;
  }

  testCases.forEach((tc, idx) => {
    const step = (tc.steps && tc.steps[0]) ? tc.steps[0] : {};
    const card = document.createElement('div');
    card.className = 'testcase-card';
    card.innerHTML = `
      <div class="testcase-header">
        <span>Test Case ${idx + 1}</span>
        <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); float:right;">${escapeHtml(step.methodName || 'solution')}</span>
      </div>
      <div class="testcase-content">
        <div>
          <div class="field-label">Input</div>
          <div class="field-box">${escapeHtml(JSON.stringify(step.input || []))}</div>
        </div>
        <div>
          <div class="field-label">Expected Output</div>
          <div class="field-box" style="color:var(--success);">${escapeHtml(JSON.stringify(step.expected))}</div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function populateQuickSelect() {
  const select = document.getElementById('quick-question-select');
  if (!select) return;
  select.innerHTML = '';

  state.questionsIndex.forEach(q => {
    const opt = document.createElement('option');
    opt.value = q.id;
    opt.textContent = `${q.title} (${q.difficultyLabel || 'Medium'})`;
    select.appendChild(opt);
  });

  select.onchange = (e) => loadQuestionById(e.target.value);
}

function populateExplorerTable(questions) {
  const tbody = document.getElementById('questions-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!questions || questions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">No questions match the current filters.</td></tr>';
    return;
  }

  questions.forEach(q => {
    const tr = document.createElement('tr');
    const compName = formatCompanyName(q.company || 'General');
    const diffLabel = q.difficultyLabel || 'Medium';
    const tagsHtml = (q.tags || []).slice(0, 2).map(t => `<span class="tag-pill">${escapeHtml(formatTag(t))}</span>`).join(' ');

    tr.innerHTML = `
      <td><span class="dot-green" title="Offline Available"></span></td>
      <td><strong>${escapeHtml(q.title)}</strong></td>
      <td><span class="badge badge-company">${escapeHtml(compName)}</span></td>
      <td><span class="badge badge-difficulty ${diffLabel.toLowerCase()}">${diffLabel}</span></td>
      <td><div class="tags-list">${tagsHtml}</div></td>
      <td style="font-family:var(--font-mono); font-size:12px;">${q.testCaseCount || 0}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="selectQuestionAndClose('${q.id}')">Practice</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function populateExplorerFilters() {
  const compSelect = document.getElementById('explorer-comp-filter');
  if (!compSelect) return;

  const companies = new Set();
  state.questionsIndex.forEach(q => {
    if (q.company) companies.add(q.company);
  });

  compSelect.innerHTML = '<option value="">All Companies</option>';
  Array.from(companies).sort().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = formatCompanyName(c);
    compSelect.appendChild(opt);
  });
}

function filterQuestions() {
  const search = (document.getElementById('explorer-search')?.value || '').toLowerCase();
  const company = document.getElementById('explorer-comp-filter')?.value || '';
  const diff = document.getElementById('explorer-diff-filter')?.value || '';

  const filtered = state.questionsIndex.filter(q => {
    const titleMatch = (q.title || '').toLowerCase().includes(search);
    const tagMatch = (q.tags || []).some(t => t.toLowerCase().includes(search));
    const compMatch = (q.company || '').toLowerCase().includes(search);
    const searchMatch = !search || titleMatch || tagMatch || compMatch;

    const companyFilterMatch = !company || q.company === company;
    const diffFilterMatch = !diff || String(q.difficulty) === String(diff);

    return searchMatch && companyFilterMatch && diffFilterMatch;
  });

  populateExplorerTable(filtered);
}

function selectQuestionAndClose(qid) {
  closeExplorer();
  loadQuestionById(qid);
}
/**
 * AlgoStudio Client Bootstrap
 */

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initSplitter();
  initEditor();
  await loadQuestionsIndex();

  const hashQid = getHashParam('q');
  if (hashQid) {
    await loadQuestionById(hashQid);
  } else if (state.questionsIndex && state.questionsIndex.length > 0) {
    await loadQuestionById(state.questionsIndex[0].id);
  }
});
