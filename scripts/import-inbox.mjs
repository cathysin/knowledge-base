// T012-B / T035：把 knowledge-inbox/<bot>/<YYYY-MM-DD>.md
// 或 <YYYY-MM-DD-HHMM>.md 导入 content/<slug>/<YYYY>/<YYYY-MM-DD>-<slot>.md。
// 标题含「盘中」且文件名带 HHMM 时，写成 <YYYY-MM-DD>-<HHMM>.md，不占用 daily。
// 目标 daily/pre/post 已存在、且 source/origin 指向另一份收件箱文件时，
// 带 HHMM 的新文件改写到 <YYYY-MM-DD>-<HHMM>.md。同一 source 仍原地覆盖。
// 用法：node scripts/import-inbox.mjs [收件箱目录]（默认 ../knowledge-inbox）
// 幂等：重复跑只覆盖同名输出文件；只写 content/ 目录，不删任何文件，不改收件箱。
// 不写 compliance_checked（这些推送没过合规审查）；不在正文末尾另加免责声明（页脚已有）。
// 发现疑似敏感信息（邮箱、密钥/令牌、账户号码）的文件不导入，脚本以非 0 退出。
// 正文里含本机路径（/workspace/ 等）的句子整句删掉；删完还残留路径的文件不导入。
// 写入 content/ 之前清洗正文（T035）：去掉内部流程句和 Cathy /「仅供内部参考」字样，
// 以及整句指向 HTML 文件/表的「见 HTML」「见 HTML 主文件」。
// 保留「不构成投资建议」以及新闻事实里的「内部调查」「未确认」「未经公司确认」。
// 页标题如果还没有该篇日期（YYYY-MM-DD），写入时补上「 · YYYY-MM-DD」。
// 标题里已经出现同一日期（间隔符可以是 ·、｜ 或空格）则不再补。
// 删掉短语或句子时，同一行其余字节保持原样：不重排 ， / 、 / ；，
// 不动数字里的英文逗号（两侧都是 ASCII 数字），保留被留下的行的行尾空格。
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'content');

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

// 本机路径：/workspace/、/home/、/cursor/ 等开头。
const LOCAL_PATH = /(?:^|[\s`'"(（：:，,])\/(?:workspace|home|cursor|tmp|root|Users|mnt|opt)\//;

/**
 * 页标题还没有该篇 YYYY-MM-DD 时，补上「 · YYYY-MM-DD」。
 * 同一日期已经出现在标题里（·、｜、空格或其他间隔符都可以）则原样返回。
 */
export function ensureTitleDate(title, date) {
  const text = String(title ?? '').trim();
  const ymd = String(date ?? '').trim().slice(0, 10);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return text;
  if (text.includes(ymd)) return text;
  return `${text} · ${ymd}`;
}

/** YYYY-MM-DD.md 与 YYYY-MM-DD-HHMM.md 取日期；其他仍含日期的文件名保持原有兜底。 */
export function fileDateOf(filename) {
  const named = String(filename).match(/^(\d{4}-\d{2}-\d{2})(?:-\d{4})?\.md$/);
  if (named) return named[1];
  return (String(filename).match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
}

/** YYYY-MM-DD-HHMM.md → HHMM；没有钟点则空字符串。 */
export function fileClockOf(filename) {
  const named = String(filename).match(/^\d{4}-\d{2}-\d{2}-(\d{4})\.md$/);
  return named ? named[1] : '';
}

/** 删掉含本机路径的句子（代码块外）；整行删空就去掉这一行。 */
export function stripLocalPaths(body) {
  let inFence = false;
  const out = [];
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; out.push(line); continue; }
    if (inFence || !LOCAL_PATH.test(line)) { out.push(line); continue; }
    const kept = (line.match(/[^。！？!?]+[。！？!?]*/g) ?? []).filter((s) => !LOCAL_PATH.test(s)).join('').trimEnd();
    if (kept.trim()) out.push(kept);
  }
  return out.join('\n');
}

/** 标题或正文里的「（待确认）」「（待 Cathy 确认）」。只删这对括号，不改行内其他空格。 */
export function stripPendingParens(s) {
  return String(s).replace(/[（(]\s*待(?:\s*Cathy\s*)?确认\s*[）)]/gi, '');
}

function stripInternalPhrase(s) {
  if (!s.includes('仅供内部参考')) return s;
  return s.replace(/(?:\*\*|__)?仅供内部参考(?:\*\*|__)?(?:[，,、]\s*)?/g, '');
}

function stillProcess(s) {
  if (/详?见\s*HTML\b/.test(s)) return true;
  if (/HTML\s*主文件/.test(s)) return true;
  if (/完整可搜可排序/.test(s)) return true;
  if (/完整权重复核/.test(s)) return true;
  if (/18[:：]00\s*完整版/.test(s)) return true;
  if (/curl\s*核验/i.test(s)) return true;
  if (/本机(?:已)?核验/.test(s)) return true;
  if (/curl/i.test(s) && /HTTP\s*200/i.test(s)) return true;
  if (/待\s*Cathy\s*确认/i.test(s)) return true;
  if (/以上均?待确认/.test(s)) return true;
  if (/对外口径待\s*(?:Cathy\s*)?确认/.test(s)) return true;
  if (/Cathy/i.test(s) && /确认|过目|审阅|审核|定稿|口径/.test(s)) return true;
  return false;
}

function needsClean(s) {
  if (s.includes('仅供内部参考')) return true;
  if (/[（(]\s*待(?:\s*Cathy\s*)?确认\s*[）)]/i.test(s)) return true;
  return stillProcess(s);
}

function hasProtected(s) {
  return /内部调查|未确认|不构成投资建议/.test(s);
}

/** ASCII 数字之间的英文逗号是小数/千分位，不是分句分隔符。 */
function isNumericComma(s, i) {
  if (s[i] !== ',') return false;
  const prev = s.charCodeAt(i - 1);
  const next = s.charCodeAt(i + 1);
  return prev >= 48 && prev <= 57 && next >= 48 && next <= 57;
}

/** 按 ， 、 和非数字英文逗号切开，分隔符记在后一段上，便于原样拼回。 */
function splitClauses(s) {
  const clauses = [];
  let start = 0;
  let sepBefore = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '，' || ch === '、' || (ch === ',' && !isNumericComma(s, i))) {
      clauses.push({ text: s.slice(start, i), sepBefore });
      sepBefore = ch;
      start = i + 1;
    }
  }
  clauses.push({ text: s.slice(start), sepBefore });
  return clauses;
}

function disclaimerTail(s) {
  const idx = s.search(/不构成投资建议/);
  if (idx < 0) return '';
  let tail = s.slice(idx).trim().replace(/^[，,、\s]+/, '');
  if (!/[。！？.!?]$/.test(tail)) tail += '。';
  return tail;
}

function isEffectivelyEmpty(s) {
  return !/[\u4e00-\u9fffA-Za-z0-9*]/.test(s);
}

function tidyAfterExcision(s) {
  let t = s.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/^[，,、;；：:\s的但]+/, '');
  t = t.replace(/[，,、;；\s]+$/, '');
  t = t.replace(/(?:见|详见)$/, '');
  return t.trim();
}

// 同一分句里既有流程用语又有要留下的事实时，只挖掉流程用语。
const EXCISE = [
  /详?见\s*HTML(?:\s*主文件)?/g,
  /完整可搜可排序总表见\s*HTML\s*主文件[。.]?/g,
  /完整可搜可排序[^，,、。！？!?；;\n]*/g,
  /见\s*HTML\s*主文件/g,
  /HTML\s*主文件/g,
  /完整权重复核放在今日\s*18[:：]00\s*完整版[。.]?/g,
  /完整权重复核[^，,、。！？!?；;\n]*/g,
  /完整(?:表|复核)[^，,、。！？!?；;\n]{0,24}?今日\s*18[:：]00\s*完整版/g,
  /今日\s*18[:：]00\s*完整版/g,
  /18[:：]00\s*完整版/g,
  /链接已\s*curl\s*核验为\s*HTTP\s*200[。.]?/gi,
  /(?:已\s*)?curl\s*核验(?:为\s*HTTP\s*200)?/gi,
  /本机已核验/g,
  /本机核验/g,
  /对外口径待\s*Cathy\s*确认/gi,
  /对外口径待确认/g,
  /以上均待\s*Cathy\s*确认/gi,
  /以上待\s*Cathy\s*确认/gi,
  /以上均待确认/g,
  /以上待确认/g,
  /待\s*Cathy\s*确认/gi,
  /请\s*Cathy\s*(?:确认|过目|审阅|审核|定稿)/gi,
  /交\s*Cathy\s*(?:确认|过目|审阅|审核|定稿)/gi,
  /由\s*Cathy\s*(?:确认|过目|审阅|审核|定稿)/gi,
  /Cathy\s*(?:确认|过目|审阅|审核|定稿)/gi,
];

function cleanClause(raw) {
  const stripped = stripPendingParens(stripInternalPhrase(raw));
  const c = stripped.trim();
  if (!c || isEffectivelyEmpty(c)) return disclaimerTail(raw);
  if (stillProcess(c) && !hasProtected(c)) return disclaimerTail(c);
  if (!stillProcess(c)) return stripped === raw ? raw : stripped;
  let next = c;
  for (const re of EXCISE) {
    re.lastIndex = 0;
    next = next.replace(re, '');
  }
  next = tidyAfterExcision(next);
  if (isEffectivelyEmpty(next)) return disclaimerTail(c);
  return next;
}

function preferDisclaimer(s) {
  return s.replace(/^(?:本报告|本档|本文|本稿|本文件)\s*(?=不构成投资建议)/, '');
}

function cleanSentence(sentence) {
  if (!needsClean(sentence)) return sentence;
  const removedInternal = sentence.includes('仅供内部参考');
  const stripped = stripPendingParens(stripInternalPhrase(sentence));
  const clauses = splitClauses(stripped);
  const kept = [];
  let droppedBefore = false;
  let changed = stripped !== sentence;
  for (const clause of clauses) {
    const text = cleanClause(clause.text);
    if (isEffectivelyEmpty(text)) { droppedBefore = true; changed = true; continue; }
    let piece = text;
    if (droppedBefore) {
      const next = piece.replace(/^[ \t]*(?:但是|但|并且|而且)/, '');
      if (next !== piece) changed = true;
      piece = next;
    }
    if (isEffectivelyEmpty(piece)) { droppedBefore = true; changed = true; continue; }
    if (piece !== clause.text) changed = true;
    kept.push({ piece, sepBefore: clause.sepBefore });
    droppedBefore = false;
  }
  if (!kept.length) return disclaimerTail(sentence);
  if (!changed) return sentence;
  let joined = kept[0].piece;
  for (let i = 1; i < kept.length; i++) joined += kept[i].sepBefore + kept[i].piece;
  if (/[。！？!?；;]$/.test(stripped) && !/[。！？!?；;]$/.test(joined)) {
    joined += stripped.match(/[。！？!?；;]$/)[0];
  }
  if (removedInternal) joined = preferDisclaimer(joined);
  return joined;
}

function cleanSentences(text) {
  const parts = String(text).match(/[^。！？!?；;]+[。！？!?；;]?/g);
  if (!parts) return String(text);
  let out = '';
  for (const part of parts) {
    if (!needsClean(part)) { out += part; continue; }
    const c = cleanSentence(part);
    if (isEffectivelyEmpty(c)) continue;
    out += c;
  }
  const consumed = parts.join('');
  if (consumed.length < text.length) out += text.slice(consumed.length);
  return out;
}

function cleanLine(line) {
  if (!needsClean(line)) return line;
  const trail = line.match(/[ \t]*$/)[0];
  const core = trail ? line.slice(0, -trail.length) : line;
  let cleaned;
  const heading = core.match(/^(\s*#{1,6}\s+)(.*)$/);
  if (heading) {
    const rest = cleanSentences(heading[2]).trim();
    if (!rest || isEffectivelyEmpty(rest)) cleaned = '';
    else cleaned = `${heading[1].replace(/\s+$/, '')} ${rest}`.replace(/[ \t]{2,}/g, ' ');
  } else {
    const listed = core.match(/^(\s*(?:>\s*)*(?:[-*+]|\d+\.)\s+)(.*)$/);
    if (listed) {
      const rest = cleanSentences(listed[2]).trim();
      cleaned = isEffectivelyEmpty(rest) ? '' : listed[1] + rest;
    } else {
      cleaned = cleanSentences(core);
    }
  }
  if (cleaned.trim() === '') return '';
  return cleaned + trail;
}

/** 清洗即将写入 content/ 的正文。纯函数，不读不写收件箱。 */
export function cleanImportedBody(body) {
  const out = [];
  for (const line of String(body).split(/\r?\n/)) {
    if (line.trim() === '') { out.push(''); continue; }
    const cleaned = cleanLine(line);
    if (cleaned.trim() === '') continue;
    out.push(cleaned);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

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

function unquoteYaml(value) {
  const text = String(value ?? '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

/** 已写入页面的收件箱来源。没有文件返回 null；没有 source/origin 返回空字符串。 */
export function readTrackedSource(filePath) {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf8');
  const fm = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return '';
  let source = '';
  let origin = '';
  for (const line of fm[1].split(/\r?\n/)) {
    const kv = line.match(/^(source|origin)\s*[:：]\s*(.*)$/);
    if (!kv) continue;
    if (kv[1] === 'source') source = unquoteYaml(kv[2]);
    else origin = unquoteYaml(kv[2]);
  }
  return source || origin;
}

/**
 * 输出文件名后缀。开盘前/盘后仍用 detectSlot 的结果。
 * 盘中标题且文件名带 HHMM 时用 HHMM。
 * daily/pre/post 已有另一份收件箱来源时，带 HHMM 的新文件也改用 HHMM。
 * 同一 source（或旧文件还没有 source）仍返回原 slot，原地更新。
 */
export function chooseOutputSlot(detected, { title, clock, existingSource, sourceRel }) {
  const named = detected === 'daily' || detected === 'pre' || detected === 'post';
  if (/盘中|盤中/.test(title || '') && clock && detected !== 'pre' && detected !== 'post') return clock;
  if (clock && named && existingSource && existingSource !== sourceRel) return clock;
  return detected;
}

function yamlSlot(slot) {
  return /^\d{4}$/.test(slot) ? JSON.stringify(slot) : slot;
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

/** 把盘后简报中已知的章节行转为标题，避免普通编号列表和正文被误判。 */
export function normalizeMarketBriefLayout(body) {
  const lines = String(body).split(/\r?\n/);
  const sections = /^(\d+)\.\s+(全天收市表现|板块涨跌与个股|南向资金|明日关注|早盘走势|主要板块|异动个股)\s*$/;
  const output = [];
  let inFence = false;
  let inDetails = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; output.push(line); continue; }
    if (/^\s*<details\b/i.test(line)) inDetails = true;
    if (inFence || inDetails) {
      output.push(line);
      if (/<\/details>/i.test(line)) inDetails = false;
      continue;
    }
    const section = line.match(sections);
    const next = lines[i + 1] ?? '';
    if (section && (i === 0 || lines[i - 1].trim() === '') && next.trim() && !/^\d+\.\s/.test(next)) {
      output.push(`## ${section[1]}. ${section[2]}`, '');
      continue;
    }
    // 仅拆分已知的来源或正文段落标签，保留所有原文与链接。
    if (/^(?:来源：|下跌方面，)/.test(line) && output.length && output.at(-1).trim() && !/^\s*(?:[-*+]|\d+\.)\s/.test(output.at(-1))) output.push('');
    output.push(line);
  }
  return output.join('\n').replace(/。(?=主板成交额 1,741\.08|餐饮、乳制品等消费股|内银股偏强，工商银行|腾讯控股收报 390\.4|部分行情页把港股通)/g, '。\n\n');
}

/** 将新闻影响的明确字段标签提升为小标题，不改动普通加粗文本。 */
export function normalizeNewsImpactLayout(body) {
  const lines = String(body).split(/\r?\n/);
  const output = [];
  let inFence = false;
  let inDetails = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; output.push(line); continue; }
    if (/^\s*<details\b/i.test(line)) inDetails = true;
    if (inFence || inDetails) {
      output.push(line);
      if (/<\/details>/i.test(line)) inDetails = false;
      continue;
    }
    const label = line.match(/^\*\*([①②④]\s*(?:新闻概要|影响行业与板块|影响原因分析[^*]*))\*\*\s*$/);
    const direction = line.match(/^\*\*(③\s*影响方向)\*\*([：:]\s*)(\S.*)$/);
    if (label) { output.push(`#### ${label[1]}`); continue; }
    if (direction) { output.push(`#### ${direction[1]}${direction[2].trim()}`, '', direction[3]); continue; }
    if (/^(?:来源|出处)[:：]\s*$/.test(line) && /^\s*[-*+]\s+/.test(lines.slice(i + 1).find((item) => item.trim()) ?? '')) {
      output.push(`#### ${line.trim()}`);
      continue;
    }
    output.push(line);
  }
  return output.join('\n');
}

/** 把 AI 情报的固定字段从顶层列表改为小标题，保留字段内段落和来源列表。 */
export function normalizeAiIntelLayout(body) {
  const lines = String(body).split(/\r?\n/);
  const output = [];
  let field = false, inFence = false, inDetails = false;
  const marker = /^- (?:\*\*(发生了什么|来源|对你的工作意味着什么)[：:]?\*\*[：:]?|(?<plain>白话)[：:])\s*(.*)$/;
  for (const raw of lines) {
    const line = field && /^  /.test(raw) ? raw.slice(2) : raw;
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; output.push(line); continue; }
    if (!inFence && /^\s*<details\b/i.test(line)) inDetails = true;
    if (inFence || inDetails) {
      output.push(line);
      if (/<\/details>/i.test(line)) inDetails = false;
      continue;
    }
    const match = raw.match(marker);
    if (match) {
      field = true;
      const label = match[1] || match.groups.plain;
      const title = label === '来源' ? '参考来源' : label;
      if (output.length && output.at(-1).trim()) output.push('');
      output.push(`### ${title}`, '');
      if (match[3]) output.push(match[3]);
      continue;
    }
    if (field && raw.trim() && !/^  /.test(raw)) field = false;
    output.push(line);
  }
  return output.join('\n');
}

function cleanedSummary(summary) {
  if (!summary) return '';
  const s = cleanImportedBody(summary).replace(/\s+/g, ' ').trim();
  if (!s || s.length > 120) return '';
  if (/不构成投资建议|仅供参考/.test(s) && s.length < 160) return '';
  return s;
}

const yamlStr = (s) => JSON.stringify(String(s));

function main() {
  const INBOX = resolve(process.argv[2] ?? join(ROOT, '..', 'knowledge-inbox'));
  let bots;
  try {
    bots = readdirSync(INBOX);
  } catch (err) {
    console.error(`打不开收件箱 ${INBOX}: ${err.message}`);
    process.exit(1);
  }

  const results = [];
  const skipped = [];
  let hadError = false;
  for (const bot of bots.sort()) {
    const dir = join(INBOX, bot);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
      const src = join(dir, f);
      const raw = readFileSync(src, 'utf8');
      const hits = SENSITIVE.filter(([re]) => re.test(raw)).map(([, why]) => why);
      if (hits.length) { skipped.push({ src, reason: hits.join('、') }); hadError = true; continue; }

      const { data, body: body0 } = parseFrontMatter(raw);
      let body = cleanImportedBody(stripLocalPaths(body0));
      let title = data.title ? cleanSentences(data.title).trim() : '';
      if (!title) {
        const h = body.match(/^#\s+(.+?)\s*#*\s*$/m);
        title = h ? cleanSentences(stripMd(h[1])).trim() : '';
      }
      const date = (data.date || fileDateOf(f) || '').slice(0, 10);
      const source_bot = data.source_bot || bot;
      const category = BOT_TO_SLUG[source_bot] ?? BOT_TO_SLUG[bot] ?? data.category;
      const errs = [];
      if (!title) errs.push('没有标题');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.push('没有日期');
      if (!category || !Object.values(BOT_TO_SLUG).includes(category)) errs.push(`分类未知（${bot}）`);
      body = fixHeadings(body, title);
      if (category === 'market-brief') body = normalizeMarketBriefLayout(body);
      if (category === 'news-impact') body = normalizeNewsImpactLayout(body);
      if (category === 'ai-intel') body = normalizeAiIntelLayout(body);
      const detected = detectSlot(title, data.slot);
      const sourceRel = relative(INBOX, src).split(sep).join('/');
      const clock = fileClockOf(f);
      const slotTarget = join(CONTENT, category, date.slice(0, 4), `${date}-${detected}.md`);
      const slot = chooseOutputSlot(detected, {
        title,
        clock,
        existingSource: readTrackedSource(slotTarget),
        sourceRel,
      });
      const summary = cleanedSummary(data.summary) || makeSummary(body);
      if (!summary) errs.push('提不出摘要');
      if (!body.trim()) errs.push('正文为空');
      if (LOCAL_PATH.test(body)) errs.push('删句后仍含本机路径');
      if (errs.length) { skipped.push({ src, reason: errs.join('、') }); hadError = true; continue; }

      title = ensureTitleDate(title, date);
      const outPath = join(CONTENT, category, date.slice(0, 4), `${date}-${slot}.md`);
      const rel = relative(CONTENT, outPath);
      if (rel.startsWith('..') || rel.includes(`..${sep}`)) throw new Error(`输出路径越出 content/：${outPath}`);
      const fm = [
        '---',
        `title: ${yamlStr(title)}`,
        `date: ${date}`,
        `category: ${category}`,
        `source_bot: ${yamlStr(source_bot)}`,
        `source: ${yamlStr(sourceRel)}`,
        `slot: ${yamlSlot(slot)}`,
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
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirect) main();
