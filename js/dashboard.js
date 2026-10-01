/**
 * AlgoStudio Question Management Dashboard & Editor Controller
 */

let editingQuestionId = null;
let currentTestCasesBuilder = [];

function openDashboard() {
  const modal = document.getElementById('dashboard-modal');
  if (modal) modal.classList.add('open');
  switchToListView();
  renderDashboardList();
}

function closeDashboard() {
  const modal = document.getElementById('dashboard-modal');
  if (modal) modal.classList.remove('open');
}

function switchToListView() {
  document.getElementById('dashboard-view-list').classList.add('active');
  document.getElementById('dashboard-view-editor').classList.remove('active');
}

function switchToEditorView() {
  document.getElementById('dashboard-view-list').classList.remove('active');
  document.getElementById('dashboard-view-editor').classList.add('active');
}

async function renderDashboardList() {
  const tbody = document.getElementById('dashboard-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px;">Loading questions...</td></tr>';

  try {
    const questions = await storageService.listQuestions();
    state.questionsIndex = questions;

    // Update stats
    let easy = 0, med = 0, hard = 0;
    questions.forEach(q => {
      if (q.difficulty === 1) easy++;
      else if (q.difficulty === 3) hard++;
      else med++;
    });

    document.getElementById('dash-stat-total').textContent = questions.length;
    document.getElementById('dash-stat-easy').textContent = easy;
    document.getElementById('dash-stat-med').textContent = med;
    document.getElementById('dash-stat-hard').textContent = hard;

    tbody.innerHTML = '';
    if (questions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">No questions found. Click "+ Create Question" to add one!</td></tr>';
      return;
    }

    questions.forEach(q => {
      const tr = document.createElement('tr');
      const diffLabel = q.difficultyLabel || 'Medium';
      tr.innerHTML = `
        <td><strong>${escapeHtml(q.title)}</strong></td>
        <td><span class="badge badge-company">${escapeHtml(q.company || 'General')}</span></td>
        <td><span class="badge badge-difficulty ${diffLabel.toLowerCase()}">${diffLabel}</span></td>
        <td style="font-family:var(--font-mono); font-size:12px;">${q.testCaseCount || 0}</td>
        <td><span class="tag-pill">${(q.tags || []).slice(0, 2).join(', ') || 'None'}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm btn-secondary" onclick="openQuestionEditor('${q.id}')">Edit</button>
            <button class="btn btn-sm btn-primary" onclick="practiceFromDashboard('${q.id}')">Practice</button>
            <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="deleteQuestionFromDashboard('${q.id}', '${escapeHtml(q.title)}')">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger); padding:24px;">Failed to load questions: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function openQuestionEditor(qid = null) {
  editingQuestionId = qid;
  switchToEditorView();

  const titleElem = document.getElementById('dash-editor-title');
  const banner = document.getElementById('dash-verify-banner');
  banner.style.display = 'none';

  if (qid) {
    titleElem.textContent = 'Edit Question';
    try {
      const q = await storageService.getQuestion(qid);
      populateEditorForm(q);
    } catch (err) {
      showToast(`Error loading question: ${err.message}`);
    }
  } else {
    titleElem.textContent = 'Create New Question';
    populateEditorForm({
      title: '',
      companyName: 'General',
      difficulty: 2,
      stages: ['OA'],
      tags: ['Algorithms'],
      description: '## Problem Description\n\nGiven ...\n\n### Examples\n\n#### Example 1:\n```\nInput: ...\nOutput: ...\n```\n\n### Constraints:\n- ...\n',
      editorial: '## Solution Approach\n\n...',
      definition: {
        className: 'Solution',
        methods: [{ name: 'solve', params: [{ name: 'nums', type: 'list[int]' }] }]
      },
      language: {
        python: {
          predefinedCode: 'class Solution:\n    def solve(self, nums: list[int]) -> int:\n        # Write your code here\n        pass\n',
          solutionCode: 'class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)\n'
        }
      },
      testCases: [
        {
          steps: [
            { methodName: 'solve', input: [[1, 2, 3]], expected: 6 }
          ]
        }
      ]
    });
  }
}

function populateEditorForm(q) {
  document.getElementById('form-q-title').value = q.title || '';
  const comp = Object.keys(q.company || {})[0] || q.companyName || 'General';
  document.getElementById('form-q-company').value = comp;
  document.getElementById('form-q-diff').value = q.difficulty || 2;
  document.getElementById('form-q-tags').value = (q.tags || q.algorithmTags || []).join(', ');
  document.getElementById('form-q-desc').value = q.description || '';
  document.getElementById('form-q-editorial').value = q.editorial || q.explanation || '';

  const def = q.definition || {};
  document.getElementById('form-q-class').value = def.className || 'Solution';
  const method = (def.methods && def.methods[0]) ? def.methods[0].name : 'solve';
  document.getElementById('form-q-method').value = method;

  const lang = q.language?.python || {};
  document.getElementById('form-q-starter').value = lang.predefinedCode || '';
  document.getElementById('form-q-solution').value = lang.solutionCode || '';

  // Test cases builder
  const listContainer = document.getElementById('testcases-builder-list');
  listContainer.innerHTML = '';
  const tcList = q.testCases || [];
  if (tcList.length === 0) {
    addTestCaseRow('[]', '0');
  } else {
    tcList.forEach(tc => {
      const step = (tc.steps && tc.steps[0]) ? tc.steps[0] : {};
      addTestCaseRow(JSON.stringify(step.input || []), JSON.stringify(step.expected !== undefined ? step.expected : ''));
    });
  }
}

function addTestCaseRow(inputVal = '[]', expectedVal = '0') {
  const container = document.getElementById('testcases-builder-list');
  const idx = container.children.length + 1;
  const div = document.createElement('div');
  div.className = 'testcase-builder-item';
  div.innerHTML = `
    <div class="testcase-builder-header">
      <span>Test Case #${idx}</span>
      <button type="button" class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="removeTestCaseRow(this)">Remove</button>
    </div>
    <div class="testcase-inputs-row">
      <div class="form-group">
        <label>Input (JSON Array of Args)</label>
        <input type="text" class="tc-input" value="${escapeHtml(inputVal)}" placeholder="e.g. [[2, 7, 11, 15], 9]">
      </div>
      <div class="form-group">
        <label>Expected Output (JSON)</label>
        <input type="text" class="tc-expected" value="${escapeHtml(expectedVal)}" placeholder="e.g. [0, 1]">
      </div>
    </div>
  `;
  container.appendChild(div);
}

function removeTestCaseRow(btn) {
  const item = btn.closest('.testcase-builder-item');
  if (item) item.remove();
  // Renumber headers
  const container = document.getElementById('testcases-builder-list');
  Array.from(container.children).forEach((child, idx) => {
    const span = child.querySelector('.testcase-builder-header span');
    if (span) span.textContent = `Test Case #${idx + 1}`;
  });
}

function collectTestCasesFromBuilder(methodName) {
  const rows = document.querySelectorAll('#testcases-builder-list .testcase-builder-item');
  const cases = [];

  for (const row of rows) {
    const inputStr = row.querySelector('.tc-input').value.trim() || '[]';
    const expectedStr = row.querySelector('.tc-expected').value.trim() || 'null';
    let inputParsed = [];
    let expectedParsed = null;

    try {
      inputParsed = JSON.parse(inputStr);
      if (!Array.isArray(inputParsed)) inputParsed = [inputParsed];
    } catch (e) {
      throw new Error(`Invalid JSON in Input: ${inputStr}`);
    }

    try {
      expectedParsed = JSON.parse(expectedStr);
    } catch (e) {
      throw new Error(`Invalid JSON in Expected Output: ${expectedStr}`);
    }

    cases.push({
      steps: [
        {
          methodName: methodName,
          input: inputParsed,
          expected: expectedParsed
        }
      ]
    });
  }

  return cases;
}

async function verifySolutionBeforeSave() {
  const banner = document.getElementById('dash-verify-banner');
  const code = document.getElementById('form-q-solution').value.trim();
  const className = document.getElementById('form-q-class').value.trim() || 'Solution';
  const methodName = document.getElementById('form-q-method').value.trim() || 'solve';

  if (!code) {
    showToast('Please enter a Reference Solution before verifying.');
    return;
  }

  let testCases;
  try {
    testCases = collectTestCasesFromBuilder(methodName);
  } catch (err) {
    banner.className = 'verify-banner error';
    banner.style.display = 'flex';
    banner.textContent = err.message;
    return;
  }

  banner.className = 'verify-banner';
  banner.style.display = 'flex';
  banner.innerHTML = `<span class="pulse-dot"></span> Executing test cases locally...`;

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code,
        testCases: testCases,
        definition: { className: className, methods: [{ name: methodName }] }
      })
    });
    const data = await res.json();
    if (data.allPassed) {
      banner.className = 'verify-banner success';
      banner.textContent = `✓ All ${data.passed}/${data.total} Test Cases Passed! Solution is verified.`;
    } else {
      banner.className = 'verify-banner error';
      banner.textContent = `✗ Verification failed: ${data.passed}/${data.total} passed. Error: ${data.error || 'Output mismatch'}`;
    }
  } catch (err) {
    banner.className = 'verify-banner error';
    banner.textContent = `Execution error: ${err.message}`;
  }
}

async function saveQuestionFromForm() {
  const title = document.getElementById('form-q-title').value.trim();
  if (!title) {
    showToast('Question Title is required.');
    return;
  }

  const company = document.getElementById('form-q-company').value.trim() || 'General';
  const difficulty = parseInt(document.getElementById('form-q-diff').value, 10) || 2;
  const tags = document.getElementById('form-q-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const desc = document.getElementById('form-q-desc').value;
  const editorial = document.getElementById('form-q-editorial').value;
  const className = document.getElementById('form-q-class').value.trim() || 'Solution';
  const methodName = document.getElementById('form-q-method').value.trim() || 'solve';
  const starter = document.getElementById('form-q-starter').value;
  const solution = document.getElementById('form-q-solution').value;

  let testCases;
  try {
    testCases = collectTestCasesFromBuilder(methodName);
  } catch (err) {
    showToast(err.message);
    return;
  }

  const payload = {
    title: title,
    difficulty: difficulty,
    company: { [company]: { frequency: 'High' } },
    companyName: company,
    tags: tags.length > 0 ? tags : ['Algorithms'],
    description: desc,
    editorial: editorial,
    definition: {
      className: className,
      methods: [{ name: methodName }]
    },
    language: {
      python: {
        predefinedCode: starter,
        solutionCode: solution
      }
    },
    testCases: testCases
  };

  try {
    if (editingQuestionId) {
      await storageService.updateQuestion(editingQuestionId, payload);
      showToast(`Updated "${title}" successfully!`);
    } else {
      const res = await storageService.createQuestion(payload);
      showToast(`Created "${title}" successfully!`);
    }

    await loadQuestionsIndex();
    switchToListView();
    renderDashboardList();
  } catch (err) {
    showToast(`Save failed: ${err.message}`);
  }
}

async function deleteQuestionFromDashboard(qid, title) {
  if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

  try {
    await storageService.deleteQuestion(qid);
    showToast(`Deleted "${title}".`);
    await loadQuestionsIndex();
    renderDashboardList();
    if (state.currentQuestion && state.currentQuestion.id === qid) {
      if (state.questionsIndex.length > 0) {
        loadQuestionById(state.questionsIndex[0].id);
      }
    }
  } catch (err) {
    showToast(`Delete failed: ${err.message}`);
  }
}

function practiceFromDashboard(qid) {
  closeDashboard();
  loadQuestionById(qid);
}
