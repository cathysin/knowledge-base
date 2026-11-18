// Add reading roles to existing paragraphs without changing their text or links.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2] ?? 'dist';
let pages = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { if (!['_astro', 'pagefind'].includes(entry.name)) walk(path); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const html = readFileSync(path, 'utf8');
    const start = html.indexOf('<div class="prose">');
    const end = html.indexOf('<div class="article-reading-end"', start);
    if (start < 0 || end < 0) continue;
    let leadFound = false;
    let firstParagraph = true;
    const title = (html.slice(0, start).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '').replace(/<[^>]*>/g, '').replace(/\s/g, '');
    let segment = html.slice(start, end).replace(/<p>([\s\S]*?)<\/p>/g, (whole, inner) => {
      const plain = inner.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (firstParagraph) {
        firstParagraph = false;
        const repeat = plain.replace(/（(星期[一二三四五六日天])）$/, '');
        const weekday = plain.match(/（(星期[一二三四五六日天])）$/)?.[1];
        const listStart = html.indexOf('<ul', start);
        const listEnd = html.indexOf('</ul>', listStart);
        const firstP = html.indexOf('<p>', start);
        const metadata = listStart >= 0 && listEnd >= 0 && listEnd < firstP ? html.slice(listStart, listEnd) : '';
        if (title && repeat.replace(/\s/g, '') === title && (!weekday || metadata.includes(weekday))) {
          return `<p hidden data-pagefind-ignore="all">${inner}</p>`;
        }
      }
      if (!leadFound && /^(?:结论[：:]|今天最大的事[：:]|今日结论[：:])/.test(plain)) {
        leadFound = true;
        return `<p class="article-keypoint">${inner}</p>`;
      }
      if (/^(?:来源[：:]|（来源[：:])/.test(plain)) return `<p class="article-source-note">${inner}</p>`;
      return whole;
    });
    if (html.slice(0, start).includes('data-category="etf-2835"')) {
      // Preserve list text and semantics while making the report's named fields scannable.
      segment = segment.replace(/<li>(时点|事实|宏观背景|成分股因果|权重近似贡献|相关|出处|标的|大盘|组合|深演智能|拖累|支撑|ETF)([：:])/g,
        (_, label, colon) => `<li data-etf-field="${label}"><span class="etf-field-label">${label}${colon}</span>`);
      // Separate long plain-text conclusions at explicit topic transitions, preserving every character.
      segment = segment.replace(/(<h2\b[^>]*id="(?:盘中结论|收市结论|早报结论|今日结论)[^"]*"[^>]*>[\s\S]*?<\/h2>\s*<p>)([^<]{200,})(<\/p>)/g,
        (_, open, body, close) => open + body.replace(/。(?=大盘|组合|拖累|正贡献|ETF)/g, '。<br><br>') + close);
    }
    if (segment !== html.slice(start, end)) { writeFileSync(path, html.slice(0,start)+segment+html.slice(end)); pages++; }
  }
}
walk(root);
console.log(`enhance-reading：优化 ${pages} 篇文章的结论与来源`);
