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
  const horizontalSplitter = document.getElementById('horizontal-splitter');
  const rightPane = document.getElementById('right-pane');
  const consolePane = document.getElementById('console-pane');

  // Restore saved vertical split width
  const savedLeft = localStorage.getItem('algostudio_split_left');
  if (savedLeft && leftPane) {
    const val = parseFloat(savedLeft);
    if (val >= 20 && val <= 80) {
      leftPane.style.width = `${val}%`;
    }
  }

  // Restore saved horizontal console height
  const savedConsoleH = localStorage.getItem('algostudio_console_height');
  if (savedConsoleH && consolePane) {
    const val = parseInt(savedConsoleH, 10);
    if (val >= 44 && val <= 800) {
      consolePane.style.height = `${val}px`;
      if (typeof state !== 'undefined') state.consoleHeight = val;
    }
  }

  let isDraggingVertical = false;
  let isDraggingHorizontal = false;

  // Vertical Splitter Listeners (Window 1 vs Window 2+3)
  if (splitter && leftPane) {
    splitter.addEventListener('mousedown', (e) => {
      isDraggingVertical = true;
      splitter.classList.add('active');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    });
  }

  // Horizontal Splitter Listeners (Window 2 Editor vs Window 3 Console)
  if (horizontalSplitter && consolePane && rightPane) {
    horizontalSplitter.addEventListener('mousedown', (e) => {
      isDraggingHorizontal = true;
      horizontalSplitter.classList.add('active');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'row-resize';
    });
  }

  // Mouse Move Handler for both splitters
  window.addEventListener('mousemove', (e) => {
    if (isDraggingVertical && leftPane) {
      const containerWidth = window.innerWidth;
      const newWidth = (e.clientX / containerWidth) * 100;
      if (newWidth >= 20 && newWidth <= 80) {
        leftPane.style.width = `${newWidth}%`;
        localStorage.setItem('algostudio_split_left', newWidth.toFixed(2));
        if (typeof layoutEditor === 'function') {
          requestAnimationFrame(layoutEditor);
        }
      }
    } else if (isDraggingHorizontal && consolePane && rightPane) {
      const rightPaneRect = rightPane.getBoundingClientRect();
      const newHeight = rightPaneRect.bottom - e.clientY;
      const minH = 44;
      const maxH = rightPaneRect.height - 120;
      if (newHeight >= minH && newHeight <= maxH) {
        if (consolePane.classList.contains('collapsed') && newHeight > 54) {
          consolePane.classList.remove('collapsed');
        }
        consolePane.style.height = `${newHeight}px`;
        if (typeof state !== 'undefined') state.consoleHeight = Math.round(newHeight);
        localStorage.setItem('algostudio_console_height', Math.round(newHeight));
        if (typeof layoutEditor === 'function') {
          requestAnimationFrame(layoutEditor);
        }
      }
    }
  });

  // Mouse Up Handler
  window.addEventListener('mouseup', () => {
    let changed = false;
    if (isDraggingVertical) {
      isDraggingVertical = false;
      if (splitter) splitter.classList.remove('active');
      changed = true;
    }
    if (isDraggingHorizontal) {
      isDraggingHorizontal = false;
      if (horizontalSplitter) horizontalSplitter.classList.remove('active');
      changed = true;
    }
    if (changed) {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (typeof layoutEditor === 'function') {
        requestAnimationFrame(layoutEditor);
      }
    }
  });
}

function toggleConsoleCollapse() {
  const consolePane = document.getElementById('console-pane');
  if (!consolePane) return;
  const isCollapsed = consolePane.classList.contains('collapsed');
  if (isCollapsed) {
    consolePane.classList.remove('collapsed');
    const h = (typeof state !== 'undefined' && state.consoleHeight)
      || parseInt(localStorage.getItem('algostudio_console_height'), 10)
      || 240;
    consolePane.style.height = `${h}px`;
  } else {
    const currentH = consolePane.offsetHeight;
    if (currentH > 44) {
      if (typeof state !== 'undefined') state.consoleHeight = currentH;
      localStorage.setItem('algostudio_console_height', currentH);
    }
    consolePane.classList.add('collapsed');
  }
  if (typeof layoutEditor === 'function') {
    requestAnimationFrame(layoutEditor);
  }
}

function switchConsoleTab(tabId) {
  const consolePane = document.getElementById('console-pane');
  if (consolePane && consolePane.classList.contains('collapsed')) {
    consolePane.classList.remove('collapsed');
    const h = (typeof state !== 'undefined' && state.consoleHeight)
      || parseInt(localStorage.getItem('algostudio_console_height'), 10)
      || 240;
    consolePane.style.height = `${h}px`;
  }
  document.querySelectorAll('.console-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `tab-btn-${tabId}`);
  });
  document.querySelectorAll('.console-tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `console-tab-${tabId}`);
  });
  if (typeof layoutEditor === 'function') {
    requestAnimationFrame(layoutEditor);
  }
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
