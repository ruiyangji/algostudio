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
