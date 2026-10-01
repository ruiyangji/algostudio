/**
 * Lightweight Markdown & LaTeX Math Parser
 */

function parseMarkdown(md) {
  if (!md) return '';

  let html = md;

  // 1. Remove delimiter
  html = html.replace(/<!--\s*###PREMIUM_CONTENT_DELIMITER###\s*-->/g, '');

  // 2. Escape standard characters but preserve math
  html = escapeHtml(html);

  // 3. LaTeX Math formatting: $$ formula $$ or $$formula$$
  html = html.replace(/\$\$([^\$]+)\$\$/g, (m, formula) => {
    return `<span class="math-formula">${formula.trim()}</span>`;
  });

  // 4. Code Blocks
  html = html.replace(/```([a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g, (m, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // 5. Inline Code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 6. Headings
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 7. Bold and Italic
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

  // 8. Blockquotes
  html = html.replace(/^>\s?(.*$)/gim, '<blockquote>$1</blockquote>');

  // 9. Unordered Lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\n)?)+/g, '<ul>$&</ul>');

  // 10. Ordered Lists
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

  // 11. Paragraphs (split by double newline)
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<ul') || p.startsWith('<blockquote')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}
