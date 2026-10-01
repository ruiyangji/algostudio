/**
 * AlgoStudio Code Editor Service (Baseline Textarea Implementation)
 */

function initEditor() {
  const textarea = document.getElementById('code-editor');
  const lineNumbers = document.getElementById('line-numbers');
  if (!textarea || !lineNumbers) return;

  // Sync scroll between textarea and line numbers
  textarea.addEventListener('scroll', () => {
    lineNumbers.scrollTop = textarea.scrollTop;
  });

  // Handle Tab key and Auto-Indent
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      textarea.value = val.substring(0, start) + '    ' + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 4;
      updateLineNumbers();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      runCode();
    }
  });

  textarea.addEventListener('input', () => {
    updateLineNumbers();
    if (state.currentQuestion) {
      const key = `${state.currentQuestion.id}_${state.selectedLanguage}`;
      state.editorCodes[key] = textarea.value;
    }
  });

  updateLineNumbers();
}

function updateLineNumbers() {
  const textarea = document.getElementById('code-editor');
  const lineNumbers = document.getElementById('line-numbers');
  if (!textarea || !lineNumbers) return;
  const lines = textarea.value.split('\n').length || 1;
  const numArr = [];
  for (let i = 1; i <= lines; i++) {
    numArr.push(i);
  }
  lineNumbers.innerHTML = numArr.join('<br>');
}

function getEditorCode() {
  const textarea = document.getElementById('code-editor');
  return textarea ? textarea.value : '';
}

function setEditorCode(code) {
  const textarea = document.getElementById('code-editor');
  if (textarea) {
    textarea.value = code;
    updateLineNumbers();
  }
}

function onEditorLanguageChange(lang) {
  state.selectedLanguage = lang;
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

  setEditorCode(code);
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
