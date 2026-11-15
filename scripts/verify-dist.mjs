// 构建后自检（方案第 5、9、12 节）：每个 HTML 页都要有页脚免责声明、lang、viewport、唯一 <main> 和 <h1>、<title> 不重复。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist';
const DISCLAIMER = '仅个人学习笔记，不构成投资建议';
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'pagefind' && f !== '_astro') walk(p); }
    else if (f.endsWith('.html')) files.push(p);
  }
})(root);

let failed = 0;
const titles = new Map();
for (const f of files) {
  const html = readFileSync(f, 'utf8');
  const errs = [];
  if (!html.includes(DISCLAIMER)) errs.push('缺页脚免责声明');
  if (!/<html[^>]*\slang="zh-CN"/.test(html)) errs.push('html 缺 lang="zh-CN"');
  if (!html.includes('name="viewport"')) errs.push('缺 viewport');
  if ((html.match(/<main[\s>]/g) ?? []).length !== 1) errs.push('<main> 不是一个');
  if ((html.match(/<h1[\s>]/g) ?? []).length !== 1) errs.push('<h1> 不是一个');
  if (/gradient\(/i.test(html)) errs.push('出现渐变');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? '';
  if (!title) errs.push('缺 title');
  if (title) {
    const arr = titles.get(title) ?? [];
    arr.push(f);
    titles.set(title, arr);
  }
  if (errs.length) { failed++; console.error(`verify-dist 不通过 ${f}: ${errs.join('；')}`); }
}
for (const [t, fs] of titles) {
  if (fs.length > 1) {
    failed++;
    console.error(`verify-dist 不通过：重复 title「${t}」: ${fs.join('，')}`);
  }
}
console.log(`verify-dist：检查 ${files.length} 个页面，${failed} 个不通过`);
if (failed || files.length === 0) process.exit(1);
