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
  activeConsoleTestcase: 0,
  consoleHeight: 240,
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
