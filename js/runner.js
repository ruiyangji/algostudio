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
    btnRun.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Code <span class="keyboard-hint" style="opacity:0.8; font-size:11px; margin-left:2px;">(⌘↵)</span>`;
  }
}

function displayRunResults(data) {
  const consolePane = document.getElementById('console-pane');
  if (consolePane && consolePane.classList.contains('collapsed')) {
    consolePane.classList.remove('collapsed');
    const h = (typeof state !== 'undefined' && state.consoleHeight)
      || parseInt(localStorage.getItem('algostudio_console_height'), 10)
      || 240;
    consolePane.style.height = `${h}px`;
    if (typeof layoutEditor === 'function') requestAnimationFrame(layoutEditor);
  }

  if (typeof switchConsoleTab === 'function') {
    switchConsoleTab('result');
  }

  const summaryElem = document.getElementById('runner-summary-status');
  const tabsContainer = document.getElementById('results-tabs');
  const detailContainer = document.getElementById('results-detail-content');
  const statusDot = document.getElementById('console-status-dot');

  if (tabsContainer) tabsContainer.innerHTML = '';

  if (data.error && (!data.results || data.results.length === 0)) {
    if (statusDot) statusDot.className = 'console-status-dot danger';
    if (summaryElem) summaryElem.innerHTML = `<span style="color:var(--danger)">Error: Execution Failed</span>`;
    if (detailContainer) {
      detailContainer.innerHTML = `
        <div style="background:var(--danger-bg); border:1px solid var(--danger); padding:12px; border-radius:var(--radius-md); color:var(--danger-text); font-family:var(--font-mono); font-size:12px; white-space:pre-wrap;">
          ${escapeHtml(data.error)}
        </div>
      `;
    }
    return;
  }

  const allPassed = data.allPassed;
  if (statusDot) {
    statusDot.className = `console-status-dot ${allPassed ? 'success' : 'danger'}`;
  }
  const statusColor = allPassed ? 'var(--success)' : 'var(--danger)';
  const statusText = allPassed ? `All Passed (${data.passed}/${data.total})` : `${data.passed}/${data.total} Passed`;
  const timeText = data.totalTimeMs ? `in ${data.totalTimeMs}ms` : '';

  if (summaryElem) {
    summaryElem.innerHTML = `<strong style="color:${statusColor}">● ${statusText}</strong> <span class="text-muted">${timeText}</span>`;
  }

  if (tabsContainer) {
    (data.results || []).forEach((r, idx) => {
      const chip = document.createElement('button');
      chip.className = `res-tab-chip ${r.passed ? 'passed' : 'failed'} ${idx === 0 ? 'active' : ''}`;
      chip.textContent = `Case ${r.case || idx + 1}`;
      chip.onclick = () => selectResultCase(idx);
      tabsContainer.appendChild(chip);
    });
  }

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
  if (!detailContainer) return;

  detailContainer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="badge ${r.passed ? 'badge-difficulty easy' : 'badge-difficulty hard'}">${r.passed ? 'PASSED' : 'FAILED'}</span>
        <span style="font-size:13px; font-weight:600;">Test Case ${r.case || index + 1}</span>
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

function renderConsoleTestcases() {
  const q = state.currentQuestion;
  const tabsContainer = document.getElementById('console-testcase-tabs');
  const detailContainer = document.getElementById('console-testcase-detail');
  if (!tabsContainer || !detailContainer) return;

  tabsContainer.innerHTML = '';
  const testCases = q?.testCases || [];
  if (testCases.length === 0) {
    detailContainer.innerHTML = '<div class="console-empty-state"><span class="text-muted">No test cases available for this question.</span></div>';
    return;
  }

  testCases.forEach((tc, idx) => {
    const chip = document.createElement('button');
    chip.className = `testcase-chip ${idx === 0 ? 'active' : ''}`;
    chip.textContent = `Case ${idx + 1}`;
    chip.onclick = () => selectConsoleTestCase(idx);
    tabsContainer.appendChild(chip);
  });

  selectConsoleTestCase(0);
}

function selectConsoleTestCase(index) {
  const q = state.currentQuestion;
  const testCases = q?.testCases || [];
  state.activeConsoleTestcase = index;

  document.querySelectorAll('#console-testcase-tabs .testcase-chip').forEach((c, idx) => {
    c.classList.toggle('active', idx === index);
  });

  const detailContainer = document.getElementById('console-testcase-detail');
  if (!detailContainer) return;

  const tc = testCases[index];
  if (!tc) {
    detailContainer.innerHTML = '<span class="text-muted">No testcase selected.</span>';
    return;
  }

  const step = (tc.steps && tc.steps[0]) ? tc.steps[0] : tc;
  const inputData = step.input !== undefined ? step.input : (tc.input !== undefined ? tc.input : []);
  const expectedData = step.expected !== undefined ? step.expected : (tc.expected !== undefined ? tc.expected : tc.output);
  const methodName = step.methodName || (q.definition && q.definition.name) || 'solution';

  detailContainer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="font-size:13px; font-weight:600;">Case ${index + 1}</span>
      <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${escapeHtml(methodName)}</span>
    </div>
    <div>
      <div class="field-label">Input</div>
      <div class="field-box">${escapeHtml(JSON.stringify(inputData, null, 2))}</div>
    </div>
    <div>
      <div class="field-label">Expected Output</div>
      <div class="field-box" style="color:var(--success);">${escapeHtml(JSON.stringify(expectedData, null, 2))}</div>
    </div>
  `;
}

function closeResultsDrawer() {
  // Legacy compatibility stub
}
