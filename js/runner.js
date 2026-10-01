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
