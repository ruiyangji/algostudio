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
