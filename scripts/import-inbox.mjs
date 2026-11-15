// T012-B：把 knowledge-inbox/<bot>/<YYYY-MM-DD>.md 导入 content/<slug>/<YYYY>/<YYYY-MM-DD>-<slot>.md。
// 用法：node scripts/import-inbox.mjs [收件箱目录]（默认 ../knowledge-inbox）
// 幂等：重复跑只覆盖同名输出文件；只写 content/ 目录，不删任何文件。
// 不写 compliance_checked（这些推送没过合规审查）；不在正文末尾另加免责声明（页脚已有）。
// 发现疑似敏感信息（邮箱、密钥/令牌、账户号码）的文件不导入，脚本以非 0 退出。
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'content');
const INBOX = resolve(process.argv[2] ?? join(ROOT, '..', 'knowledge-inbox'));

const BOT_TO_SLUG = {
  '每日推送': 'cm-knowledge',
  '行情分析': 'market-brief',
  '新闻影响': 'news-impact',
  '2835日报': 'etf-2835',
  '港股IPO': 'hk-ipo',
  '每日AI情报': 'ai-intel',
};
const KEY_MAP = {
  title: 'title', '标题': 'title',
  date: 'date', '日期': 'date',
  source_bot: 'source_bot', 'source bot': 'source_bot', '来源 bot': 'source_bot', '来源bot': 'source_bot', '来源': 'source_bot',
  category: 'category', '分类': 'category',
  slot: 'slot', '时点': 'slot',
  summary: 'summary', '摘要': 'summary',
};
const SLOTS = ['pre', 'mid', 'mid-1', 'mid-2', 'post', 'daily'];

// 疑似敏感信息：邮箱、常见密钥/令牌格式、账户号码字样。命中就不导入。
const SENSITIVE = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, '邮箱地址'],
  [/\b(?:sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})/, '密钥/令牌'],
  [/(?:api[_-]?key|secret|password|token)\s*[:=]\s*\S{8,}/i, '密钥/令牌赋值'],
  [/(?:账户|账号|帐号|戶口|户口)(?:号码|號碼|编号)?\s*[:：]\s*[0-9A-Z-]{5,}/, '账户号码'],
  [/(?:客户|客戶)\s*[:：]/, '客户名字段'],
  [/https?:\/\/(?:[^\s/)]*[./])?(?:intranet|internal|corp|localhost)(?:[.:/]|$)|https?:\/\/[^\s/)]*\.(?:local|lan|corp|internal)(?:[:/)\s]|$)/i, '内部网址'],
];

function parseFrontMatter(raw) {
  const m = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([^:：#][^:：]*?)\s*[:：]\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    const key = KEY_MAP[kv[1].trim()] ?? KEY_MAP[kv[1].trim().toLowerCase()];
    if (key) data[key] = v; // 其他键（如 task）直接丢掉
  }
  return { data, body: raw.slice(m[0].length) };
}

function stripMd(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, '$2')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSummary(body) {
  const paras = body.split(/\r?\n\s*\r?\n/);
  for (const p of paras) {
    const lines = p.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      .filter((l) => !/^(#|[-*+]\s|\d+\.\s|\||>|```|---)/.test(l))
      .filter((l) => !/^\*\*[^*]+\*\*$/.test(l)); // 单独一行的粗体标题
    const text = stripMd(lines.join(' ')).replace(/来源[：:][^。]*。?/g, '').trim();
    if (!text) continue;
    if (!/[。！？.!?]/.test(text) && text.length < 30) continue; // 课程位置这类短标签行
    if (/^[^：:。]{1,12}[：:]/.test(text) && text.length < 60) continue; // 「日期：…」这类元数据行
    if (/不构成投资建议|仅供参考/.test(text) && text.length < 160) continue; // 免责/口径说明段
    if (text.length <= 120) return text;
    // 按句截断，尽量整句
    const sentences = text.match(/[^。！？!?]+[。！？!?]?/g) ?? [text];
    let out = '';
    for (const s of sentences) {
      if ((out + s).length > 120) break;
      out += s;
    }
    if (out.length >= 20) return out.trim();
    return text.slice(0, 119) + '…';
  }
  return '';
}

function detectSlot(title, given) {
  if (given && SLOTS.includes(given)) return given;
  if (/盘前|開盤前|开盘前|pre-?market/i.test(title)) return 'pre';
  if (/盘后|盤後|收市后|post-?market/i.test(title)) return 'post';
  return 'daily';
}

/** 去掉和页面标题重复的首个 H1；其余 H1 降成 H2（页面模板已渲染 <h1>，每页只能一个）。 */
function fixHeadings(body, title) {
  const lines = body.split(/\r?\n/);
  let inFence = false;
  let droppedFirst = false;
  const out = [];
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const h1 = !inFence && line.match(/^#\s+(.+?)\s*#*\s*$/);
    if (h1) {
      if (!droppedFirst && stripMd(h1[1]) === stripMd(title)) { droppedFirst = true; continue; }
      out.push('#' + line);
      continue;
    }
    out.push(line);
  }
  return out.join('\n').replace(/^\s*\n/, '').trimEnd() + '\n';
}

const yamlStr = (s) => JSON.stringify(String(s));

const results = [];
const skipped = [];
let hadError = false;
for (const bot of readdirSync(INBOX).sort()) {
  const dir = join(INBOX, bot);
  if (!statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    const src = join(dir, f);
    const raw = readFileSync(src, 'utf8');
    const hits = SENSITIVE.filter(([re]) => re.test(raw)).map(([, why]) => why);
    if (hits.length) { skipped.push({ src, reason: hits.join('、') }); hadError = true; continue; }

    const { data, body: body0 } = parseFrontMatter(raw);
    let body = body0;
    let title = data.title;
    if (!title) {
      const h = body.match(/^#\s+(.+?)\s*#*\s*$/m);
      title = h ? stripMd(h[1]) : '';
    }
    const fileDate = (f.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
    const date = (data.date || fileDate || '').slice(0, 10);
    const source_bot = data.source_bot || bot;
    const category = BOT_TO_SLUG[source_bot] ?? BOT_TO_SLUG[bot] ?? data.category;
    const errs = [];
    if (!title) errs.push('没有标题');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.push('没有日期');
    if (!category || !Object.values(BOT_TO_SLUG).includes(category)) errs.push(`分类未知（${bot}）`);
    body = fixHeadings(body, title);
    const slot = detectSlot(title, data.slot);
    const summary = (data.summary && data.summary.length <= 120 ? data.summary : makeSummary(body));
    if (!summary) errs.push('提不出摘要');
    if (!body.trim()) errs.push('正文为空');
    if (errs.length) { skipped.push({ src, reason: errs.join('、') }); hadError = true; continue; }

    const outPath = join(CONTENT, category, date.slice(0, 4), `${date}-${slot}.md`);
    const rel = relative(CONTENT, outPath);
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) throw new Error(`输出路径越出 content/：${outPath}`);
    const fm = [
      '---',
      `title: ${yamlStr(title)}`,
      `date: ${date}`,
      `category: ${category}`,
      `source_bot: ${yamlStr(source_bot)}`,
      `slot: ${slot}`,
      `summary: ${yamlStr(summary)}`,
      '---',
      '',
    ].join('\n');
    mkdirSync(join(CONTENT, category, date.slice(0, 4)), { recursive: true });
    const existed = existsSync(outPath);
    writeFileSync(outPath, fm + body);
    results.push({ out: relative(ROOT, outPath), title, category, slot, summaryLen: summary.length, overwrote: existed });
  }
}
console.log(JSON.stringify({ imported: results, skipped }, null, 2));
if (hadError) process.exit(1);
