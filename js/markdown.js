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
