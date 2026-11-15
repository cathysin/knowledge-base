// 构建后给文章里的 <table> 套上 7.3 要求的容器和列名（不改框架、不加 rehype 依赖）。
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist';
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'pagefind' && f !== '_astro') walk(p); }
    else if (f.endsWith('.html')) files.push(p);
  }
})(root);

let changed = 0, tables = 0;
for (const f of files) {
  let html = readFileSync(f, 'utf8');
  if (!/<table[\s>]/i.test(html) || html.includes('class="table-wrap"')) continue;
  let n = 0;
  const next = html.replace(/<table\b[\s\S]*?<\/table>/gi, (table, offset) => {
    tables++;
    n++;
    const capId = `table-caption-${n}`;
    const heading = [...html.slice(0, offset).matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].at(-1)?.[1]?.replace(/<[^>]+>/g, '').trim();
    const caption = (heading || '文章数据表').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const labels = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    let out = table;
    if (!/<caption\b/i.test(out)) {
      out = out.replace(/<table\b[^>]*>/i, (open) => `${open}<caption class="visually-hidden" id="${capId}">${caption}</caption>`);
    } else if (!/id=/.test(out.match(/<caption\b[^>]*>/i)?.[0] ?? '')) {
      out = out.replace(/<caption\b/i, `<caption id="${capId}"`);
    } else {
      const existing = out.match(/<caption\b[^>]*id="([^"]+)"/i);
      if (existing) return `<div class="table-wrap" role="region" tabindex="0" aria-labelledby="${existing[1]}">${out}</div>`;
    }
    if (labels.length) {
      let i = 0;
      out = out.replace(/<td\b([^>]*)>/gi, (m, attrs) => {
        if (/data-label=/.test(attrs)) return m;
        const label = labels[i % labels.length] ?? '';
        i++;
        return `<td data-label="${label.replace(/"/g, '&quot;')}"${attrs}>`;
      });
    }
    return `<div class="table-wrap" role="region" tabindex="0" aria-labelledby="${capId}">${out}</div>`;
  });
  if (next !== html) {
    writeFileSync(f, next);
    changed++;
  }
}
console.log(`enhance-tables：处理 ${changed} 个页面、${tables} 张表`);
