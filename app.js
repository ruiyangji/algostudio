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
/**
 * AlgoStudio LeetCode-Grade Markdown & Typography Engine
 */

function parseMarkdown(md) {
  if (!md) return '';

  let text = md;

  // 1. Remove comments & delimiters
  text = text.replace(/<!--\s*###PREMIUM_CONTENT_DELIMITER###\s*-->/g, '');

  // 2. Normalize HTML entities & clean excess whitespace
  text = text.replace(/&nbsp;/g, ' ');

  // 3. Extract & protect code blocks
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g, (m, lang, code) => {
    codeBlocks.push({ lang: lang || '', code: code.trim() });
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 4. Extract & protect display LaTeX math: $$ formula $$
  const mathFormulas = [];
  text = text.replace(/\$\$([^\$]+)\$\$/g, (m, formula) => {
    mathFormulas.push(formula.trim());
    return `__MATH_FORMULA_${mathFormulas.length - 1}__`;
  });

  // 5. Extract & protect inline code: `code`
  const inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, (m, code) => {
    inlineCodes.push(code);
    return `__INLINE_CODE_${inlineCodes.length - 1}__`;
  });

  // 6. Protect safe HTML tags (e.g. <sup>, <sub>, <br>)
  const safeTags = [];
  text = text.replace(/<(sup|sub|b|i|strong|em)(\s*\/)?>([\s\S]*?)<\/\1>/gi, (m) => {
    safeTags.push(m);
    return `__SAFE_TAG_${safeTags.length - 1}__`;
  });
  text = text.replace(/<br\s*\/?>/gi, () => {
    safeTags.push('<br>');
    return `__SAFE_TAG_${safeTags.length - 1}__`;
  });

  // Helper for inline markdown (bold, italic, complexity)
  function renderInline(str) {
    if (!str) return '';
    let res = str;
    // Bold
    res = res.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    // Complexity notation *O(...)*
    res = res.replace(/\*O\((.*?)\)\*/g, '<span class="complexity-chip">O($1)</span>');
    // Generic Italic
    res = res.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    return res;
  }

  // Placeholder container for structured cards to avoid interference with paragraph wrapping
  const structuredCards = [];
  function storeCard(html) {
    structuredCards.push(html.trim());
    return `\n\n__STRUCTURED_CARD_${structuredCards.length - 1}__\n\n`;
  }

  // 7. Parse Examples Block by Block BEFORE escaping (so > is easily identified)
  const exampleRegex = /(?:(?:\*\*|#+\s*)Example(?:\s*(\d+))?[:\.]?\*?\*?)([\s\S]*?)(?=(?:\*\*Example|#+\s*Example|\*\*Constraints|#+\s*Constraints|###\s*\**Complexity|$))/gi;
  text = text.replace(exampleRegex, (match, exNum, exBody) => {
    const lines = exBody.split('\n').map(l => l.replace(/^>\s?/, '').trim()).filter(Boolean);
    let currentField = '';
    let inputLines = [];
    let outputLines = [];
    let explLines = [];

    for (let line of lines) {
      const inputMatch = line.match(/^\*?\*?Input:\*?\*?\s*(.*)$/i);
      const outputMatch = line.match(/^\*?\*?Output:\*?\*?\s*(.*)$/i);
      const explMatch = line.match(/^\*?\*?Explanation:\*?\*?\s*(.*)$/i);

      if (inputMatch) {
        currentField = 'input';
        if (inputMatch[1]) inputLines.push(inputMatch[1]);
      } else if (outputMatch) {
        currentField = 'output';
        if (outputMatch[1]) outputLines.push(outputMatch[1]);
      } else if (explMatch) {
        currentField = 'explanation';
        if (explMatch[1]) explLines.push(explMatch[1]);
      } else {
        if (currentField === 'input') inputLines.push(line);
        else if (currentField === 'output') outputLines.push(line);
        else if (currentField === 'explanation') explLines.push(line);
      }
    }

    const inputVal = inputLines.join('\n').trim();
    const outputVal = outputLines.join('\n').trim();
    const explVal = explLines.join(' ').trim();
    const exLabel = exNum ? `Example ${exNum}` : 'Example';

    const cardHtml = `
<div class="example-card">
  <div class="example-header">
    <span class="example-badge">${exLabel}</span>
  </div>
  <div class="example-body">
    ${inputVal ? `
    <div class="example-row">
      <span class="example-key">Input:</span>
      <pre class="example-code"><code>${renderInline(inputVal)}</code></pre>
    </div>` : ''}
    ${outputVal ? `
    <div class="example-row">
      <span class="example-key">Output:</span>
      <pre class="example-code"><code>${renderInline(outputVal)}</code></pre>
    </div>` : ''}
    ${explVal ? `
    <div class="example-row explanation-row">
      <span class="example-key">Explanation:</span>
      <div class="example-explanation">${renderInline(explVal)}</div>
    </div>` : ''}
  </div>
</div>`;
    return storeCard(cardHtml);
  });

  // 8. Parse Constraints Section
  const constraintsRegex = /(?:\*\*Constraints:\*\*|\*\*Constraints\*\*|#+\s*Constraints[:\.]?|Constraints:)([\s\S]*?)(?=(?:\*\*Example|__STRUCTURED_CARD_|#+\s*Example|###|$))/gi;
  text = text.replace(constraintsRegex, (match, body) => {
    const rawItems = body.split('\n')
      .map(l => l.replace(/^>\s?/, '').trim())
      .filter(l => l.startsWith('*') || l.startsWith('-'))
      .map(l => l.replace(/^[\*\-]\s*/, '').trim());

    if (rawItems.length === 0) return match;

    const listHtml = rawItems.map(it => `<li>${renderInline(it)}</li>`).join('');
    const cardHtml = `
<div class="constraints-card">
  <div class="constraints-title">Constraints:</div>
  <ul class="constraints-list">${listHtml}</ul>
</div>`;
    return storeCard(cardHtml);
  });

  // 9. Parse Complexity Analysis in Editorial
  const complexityRegex = /(?:###\s*\**Complexity Analysis\**|\*\*Complexity Analysis\*\*)([\s\S]*?)(?=(?:###|$))/gi;
  text = text.replace(complexityRegex, (match, body) => {
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    let timeComplexity = '';
    let spaceComplexity = '';
    let otherLines = [];

    for (let l of lines) {
      const cleanLine = l.replace(/^[\*\-]\s*/, '');
      const timeMatch = cleanLine.match(/^\*?\*?Time Complexity:\*?\*?\s*(.*)$/i);
      const spaceMatch = cleanLine.match(/^\*?\*?Space Complexity:\*?\*?\s*(.*)$/i);

      if (timeMatch) {
        timeComplexity = timeMatch[1];
      } else if (spaceMatch) {
        spaceComplexity = spaceMatch[1];
      } else {
        otherLines.push(cleanLine);
      }
    }

    if (!timeComplexity && !spaceComplexity) {
      return storeCard(`<h3 class="content-h3">Complexity Analysis</h3><div class="complexity-desc">${renderInline(body)}</div>`);
    }

    const cardHtml = `
<div class="complexity-card">
  <div class="complexity-title">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
    Complexity Analysis
  </div>
  <div class="complexity-grid">
    ${timeComplexity ? `
    <div class="complexity-item">
      <div class="complexity-type-badge time">Time Complexity</div>
      <div class="complexity-desc">${renderInline(timeComplexity)}</div>
    </div>` : ''}
    ${spaceComplexity ? `
    <div class="complexity-item">
      <div class="complexity-type-badge space">Space Complexity</div>
      <div class="complexity-desc">${renderInline(spaceComplexity)}</div>
    </div>` : ''}
  </div>
  ${otherLines.length > 0 ? `<div class="complexity-extra">${renderInline(otherLines.join(' '))}</div>` : ''}
</div>`;
    return storeCard(cardHtml);
  });

  // Helper for parsing nested bullet lists
  function parseNestedList(lines) {
    if (lines.length === 0) return '';
    let html = '';
    let stack = [];

    for (let rawLine of lines) {
      if (!rawLine.trim()) continue;
      const indentMatch = rawLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      const content = rawLine.replace(/^\s*[\*\-]\s*/, '').trim();

      const level = Math.floor(indent / 4);

      while (stack.length > level + 1) {
        html += '</li></ul>';
        stack.pop();
      }

      if (stack.length === 0) {
        html += '<ul class="step-list"><li>';
        stack.push(0);
      } else if (level >= stack.length) {
        html += '<ul class="nested-list"><li>';
        stack.push(level);
      } else {
        html += '</li><li>';
      }

      html += renderInline(content);
    }

    while (stack.length > 0) {
      html += '</li></ul>';
      stack.pop();
    }

    return html;
  }

  // 10. Parse Numbered Steps in Editorial (e.g. "1. **Title**\n    - sub item")
  const stepRegex = /(?:^|\n)(\d+)\.\s+\*\*(.*?)\*\*([\s\S]*?)(?=(?:\n\s*\d+\.\s+\*\*|\n\s*###|__STRUCTURED_CARD_|$))/gi;
  text = text.replace(stepRegex, (match, stepNum, stepTitle, stepBody) => {
    const lines = stepBody.split('\n').filter(l => l.trim().length > 0);
    const listHtml = parseNestedList(lines);

    const cardHtml = `
<div class="step-card">
  <div class="step-header">
    <span class="step-number">${stepNum}</span>
    <h4 class="step-title">${renderInline(stepTitle)}</h4>
  </div>
  <div class="step-content">
    ${listHtml}
  </div>
</div>`;
    return storeCard(cardHtml);
  });

  // 11. Headings
  text = text.replace(/^#### (.*$)/gim, '<h4 class="content-h4">$1</h4>');
  text = text.replace(/^### (.*$)/gim, '<h3 class="content-h3">$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2 class="content-h2">$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1 class="content-h1">$1</h1>');

  // Ensure lists preceded by non-list text have a blank line
  text = text.replace(/([^\n])\n(\s*[-*]\s+)/g, '$1\n\n$2');
  text = text.replace(/([^\n])\n(\s*\d+\.\s+)/g, '$1\n\n$2');

  // 12. Ordered Lists (regular)
  text = text.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ol-item">$1</li>');
  text = text.replace(/(<li class="ol-item">.*<\/li>(\n)?)+/g, '<ol class="styled-ol">$&</ol>');

  // 13. Generic Bullet Lists (regular)
  text = text.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>(\n)?)+/g, '<ul class="styled-list">$&</ul>');

  // 14. Generic Blockquotes
  text = text.replace(/^>\s?(.*$)/gim, '<blockquote class="callout-quote"><p>$1</p></blockquote>');

  // 15. Inline formatting across remaining text
  text = renderInline(text);

  // 16. Paragraph wrapping
  const blocks = text.split(/\n\n+/);
  text = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('__STRUCTURED_CARD_') ||
        block.startsWith('<h') ||
        block.startsWith('<pre') ||
        block.startsWith('<ul') ||
        block.startsWith('<ol') ||
        block.startsWith('<blockquote')) {
      return block;
    }
    return `<p class="content-p">${block.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  // 17. Restore Structured Cards
  text = text.replace(/__STRUCTURED_CARD_(\d+)__/g, (m, idx) => {
    return structuredCards[parseInt(idx, 10)] || '';
  });

  // 18. Restore Code Blocks, Math, Safe Tags, and Inline Code
  text = text.replace(/__CODE_BLOCK_(\d+)__/g, (m, idx) => {
    const cb = codeBlocks[parseInt(idx, 10)];
    return `<pre class="code-block"><code class="${cb.lang}">${cb.code}</code></pre>`;
  });

  text = text.replace(/__MATH_FORMULA_(\d+)__/g, (m, idx) => {
    return `<span class="math-formula">${mathFormulas[parseInt(idx, 10)]}</span>`;
  });

  text = text.replace(/__SAFE_TAG_(\d+)__/g, (m, idx) => {
    return safeTags[parseInt(idx, 10)] || '';
  });

  text = text.replace(/__INLINE_CODE_(\d+)__/g, (m, idx) => {
    return `<code class="inline-code">${inlineCodes[parseInt(idx, 10)]}</code>`;
  });

  return text;
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

  async importZip(file) {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip' },
      body: file
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to import ZIP archive');
    return data;
  },

  exportZipUrl() {
    return '/api/export';
  }
};
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

async function importZipFile(inputElement) {
  const file = inputElement.files && inputElement.files[0];
  if (!file) return;

  showToast('Importing ZIP archive...');
  try {
    const res = await storageService.importZip(file);
    if (res.errors && res.errors.length > 0 && res.count === 0) {
      showToast(`Import failed: ${res.errors.join('; ')}`);
    } else {
      let msg = `Successfully imported ${res.count} question(s)!`;
      if (res.errors && res.errors.length > 0) {
        msg += ` (${res.errors.length} skipped)`;
      }
      showToast(msg);
      await loadQuestionsIndex();
      renderDashboardList();
      if (state.questionsIndex && state.questionsIndex.length > 0) {
        loadQuestionById(state.questionsIndex[0].id);
      }
    }
  } catch (err) {
    showToast(`Import error: ${err.message}`);
  } finally {
    inputElement.value = '';
  }
}

function exportZipFile() {
  window.location.href = storageService.exportZipUrl();
}
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

  // Render Test Cases (Tab view and Console Pane view)
  renderTestCases(q.testCases || []);
  if (typeof renderConsoleTestcases === 'function') {
    renderConsoleTestcases();
  }

  // Update Editor with language starter code or cached edits
  loadCodeForLanguage(state.selectedLanguage);

  // Reset Console Results & Status
  const statusDot = document.getElementById('console-status-dot');
  if (statusDot) statusDot.className = 'console-status-dot';
  const runnerStatus = document.getElementById('runner-summary-status');
  if (runnerStatus) runnerStatus.innerHTML = '<span class="text-muted">Click "Run Code" to test</span>';
  const resultsTabs = document.getElementById('results-tabs');
  if (resultsTabs) resultsTabs.innerHTML = '';
  const resultsDetail = document.getElementById('results-detail-content');
  if (resultsDetail) {
    resultsDetail.innerHTML = '<div class="console-empty-state"><span class="text-muted">Run your code to see offline test execution results.</span></div>';
  }

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
