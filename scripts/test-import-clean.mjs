// T035：清洗正文的单元检查，外加一次不改收件箱的导入试跑。
// 用法：node scripts/test-import-clean.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chooseOutputSlot, cleanImportedBody, fileClockOf, fileDateOf, stripLocalPaths } from './import-inbox.mjs';
import { classifyChanges, isContentPath, parseArgs, parsePorcelainZ, suggestCommitMessage } from './sync-inbox.mjs';

const repo = resolve(import.meta.dirname, '..');
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(err);
  }
}

const THREE = [
  '完整权重复核放在今日 18:00 完整版。',
  '完整可搜可排序总表见 HTML 主文件。',
  '链接已 curl 核验为 HTTP 200。',
];

check('strips the three process sentences and keeps news facts', () => {
  const src = [
    '监管已启动内部调查，数字未确认。',
    ...THREE,
    '另一条仍是内部调查，数字未确认。',
  ].join('\n');
  const out = cleanImportedBody(src);
  for (const sentence of THREE) assert.equal(out.includes(sentence), false, sentence);
  assert.match(out, /监管已启动内部调查，数字未确认。/);
  assert.match(out, /另一条仍是内部调查，数字未确认。/);
  assert.equal(out.includes('不构成投资建议'), false);
});

check('strips similar process sentences', () => {
  const src = [
    '详情见 HTML 主文件。',
    '这些链接已 curl 核验。',
    '完整复核放在今日 18:00 完整版。',
    '来源已在本机核验。',
    '服务返回 HTTP 200。',
    '新版本 curl 已发布。',
    '完整版财报于今日 18:00 发布。',
    '监管已启动内部调查，数字未确认。',
  ].join('\n');
  const out = cleanImportedBody(src);
  assert.equal(out.includes('HTML 主文件'), false);
  assert.equal(out.includes('curl 核验'), false);
  assert.equal(out.includes('18:00 完整版'), false);
  assert.equal(out.includes('本机核验'), false);
  assert.match(out, /服务返回 HTTP 200。/);
  assert.match(out, /新版本 curl 已发布。/);
  assert.match(out, /完整版财报于今日 18:00 发布。/);
  assert.match(out, /内部调查/);
  assert.match(out, /数字未确认/);
});

check('strips 11-15 Cathy and internal phrases but keeps the disclaimer', () => {
  const src = [
    '## 今日结论（待确认）',
    '## 今日结论（待 Cathy 确认）',
    '仅供内部参考，不构成投资建议。',
    '本文仅供内部参考，不构成投资建议。',
    '**仅供内部参考**，不构成投资建议。',
    '待 Cathy 确认。',
    '对外口径待 Cathy 确认。',
    '对外口径待 Cathy 确认，不构成投资建议。',
    '以上均待 Cathy 确认。',
    '以上均待 Cathy 确认，不构成投资建议。',
    '以上待确认。',
    '请 Cathy 确认后再发。',
    '仅供参考，不构成投资建议。',
    '监管已启动内部调查，数字未确认。',
    '对外口径待核实。',
    '该数字待确认。',
  ].join('\n');
  const out = cleanImportedBody(src);
  assert.match(out, /^## 今日结论$/m);
  assert.equal(out.includes('（待确认）'), false);
  assert.equal(out.includes('（待 Cathy 确认）'), false);
  assert.equal(out.includes('待 Cathy'), false);
  assert.equal(out.includes('Cathy'), false);
  assert.equal(out.includes('仅供内部参考'), false);
  assert.equal(out.includes('以上待确认'), false);
  assert.equal(out.includes('以上均待'), false);
  assert.match(out, /不构成投资建议/);
  assert.match(out, /仅供参考，不构成投资建议。/);
  assert.match(out, /监管已启动内部调查，数字未确认。/);
  assert.match(out, /对外口径待核实。/);
  assert.match(out, /该数字待确认。/);
});

check('keeps a fact that shares a sentence with a process clause', () => {
  const src = '链接已 curl 核验为 HTTP 200，但内部调查仍在继续，数字未确认。以上待确认。';
  const out = cleanImportedBody(src);
  assert.equal(out.includes('curl'), false);
  assert.equal(out.includes('以上待确认'), false);
  assert.match(out, /内部调查仍在继续/);
  assert.match(out, /数字未确认/);
  assert.equal(out.trim(), '内部调查仍在继续，数字未确认。');
});

check('does not append a disclaimer', () => {
  const out = cleanImportedBody('监管已启动内部调查，数字未确认。\n');
  assert.equal(out.includes('不构成投资建议'), false);
  assert.equal(out.trim(), '监管已启动内部调查，数字未确认。');
});

check('cleaning is idempotent', () => {
  const src = [
    '## 今日结论（待确认）',
    '监管已启动内部调查，数字未确认。',
    '仅供内部参考，不构成投资建议。',
    ...THREE,
    '仅供参考，不构成投资建议。',
  ].join('\n');
  const once = cleanImportedBody(src);
  assert.equal(cleanImportedBody(once), once);
});

check('local /workspace sentences still drop', () => {
  const out = stripLocalPaths('明细在 /workspace/work/IT/secret.txt。监管已启动内部调查，数字未确认。');
  assert.equal(out.includes('/workspace'), false);
  assert.match(out, /内部调查/);
  assert.match(out, /数字未确认/);
});

check('recognizes YYYY-MM-DD and YYYY-MM-DD-HHMM filenames', () => {
  assert.equal(fileDateOf('2026-11-16.md'), '2026-11-16');
  assert.equal(fileDateOf('2026-11-16-1114.md'), '2026-11-16');
  assert.equal(fileDateOf('2026-11-16-0900.md'), '2026-11-16');
  assert.equal(fileDateOf('README.md'), '');
});

check('sync classifies content-only changes', () => {
  assert.equal(isContentPath('content/news-impact/2026/2026-11-16-daily.md'), true);
  assert.equal(isContentPath('content-extra/a.md'), false);
  assert.equal(isContentPath('package.json'), false);
  const none = classifyChanges([]);
  assert.equal(none.kind, 'none');
  const onlyOutside = classifyChanges(parsePorcelainZ(' M package.json\0'));
  assert.equal(onlyOutside.kind, 'none');
  assert.deepEqual(onlyOutside.outside, ['package.json']);
  const content = classifyChanges(parsePorcelainZ('?? content/news-impact/2026/2026-11-16-daily.md\0'));
  assert.equal(content.kind, 'content');
  assert.deepEqual(content.content, ['content/news-impact/2026/2026-11-16-daily.md']);
  const mixed = classifyChanges(parsePorcelainZ(' M content/a.md\0 M README.md\0'));
  assert.equal(mixed.kind, 'abort');
  const renamed = classifyChanges(parsePorcelainZ('R  content/b.md\0content/a.md\0'));
  assert.equal(renamed.kind, 'content');
  const msg = suggestCommitMessage(content.content);
  assert.match(msg.subject, /1 个文件/);
  assert.match(msg.text, /content\/news-impact\/2026\/2026-11-16-daily.md/);
});

check('sync flags default to dry run', () => {
  assert.deepEqual(parseArgs([]), { inbox: undefined, commit: false, push: false });
  assert.deepEqual(parseArgs(['/tmp/in', '--commit']), { inbox: '/tmp/in', commit: true, push: false });
  assert.equal(parseArgs(['--commit', '--push', '/tmp/in']).push, true);
  assert.throws(() => parseArgs(['--push']), /--push requires --commit/);
  assert.throws(() => parseArgs(['--force']), /unknown flag/);
});

check('import writes cleaned content and does not edit the inbox', () => {
  const inbox = mkdtempSync(join(tmpdir(), 'kb-inbox-'));
  const bot = join(inbox, '新闻影响');
  mkdirSync(bot);
  const fixture = [
    '---',
    'title: "新闻（待确认）"',
    'date: 2099-01-01',
    'source_bot: 新闻影响',
    'slot: daily',
    '---',
    '',
    '# 新闻（待确认）',
    '',
    '## 今日结论（待 Cathy 确认）',
    '',
    '监管已对公司启动内部调查，数字未确认。',
    '',
    '明细在 /workspace/work/IT/secret.txt。',
    '',
    '仅供内部参考，不构成投资建议。',
    '',
    '以上均待 Cathy 确认。',
    '',
    '以上待确认。',
    '',
    '对外口径待 Cathy 确认，不构成投资建议。',
    '',
    ...THREE,
    '',
    '仅供参考，不构成投资建议。',
    '',
  ].join('\n');
  const srcPath = join(bot, '2099-01-01.md');
  const hhPath = join(bot, '2099-01-02-0900.md');
  writeFileSync(srcPath, fixture);
  writeFileSync(hhPath, [
    '---',
    'title: "午间"',
    'source_bot: 新闻影响',
    'slot: daily',
    '---',
    '',
    '公司接受内部调查，数字未确认。',
    '',
  ].join('\n'));
  const before = readFileSync(srcPath);
  const beforeHh = readFileSync(hhPath);
  const year = join(repo, 'content/news-impact/2099');
  const yearExisted = existsSync(year);
  const out1 = join(year, '2099-01-01-daily.md');
  const out2 = join(year, '2099-01-02-daily.md');
  try {
    const run = () => spawnSync(process.execPath, ['scripts/import-inbox.mjs', inbox], { cwd: repo, encoding: 'utf8' });
    const first = run();
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.deepEqual(readFileSync(srcPath), before);
    assert.deepEqual(readFileSync(hhPath), beforeHh);
    const written = readFileSync(out1, 'utf8');
    assert.match(written, /title: "新闻"/);
    assert.doesNotMatch(written, /待确认|待 Cathy|Cathy|仅供内部参考|HTML 主文件|curl 核验|18:00 完整版|\/workspace/);
    assert.match(written, /内部调查/);
    assert.match(written, /数字未确认/);
    assert.match(written, /不构成投资建议/);
    assert.match(written, /仅供参考，不构成投资建议。/);
    assert.equal(written.trimEnd().endsWith('仅供参考，不构成投资建议。'), true);
    const hh = readFileSync(out2, 'utf8');
    assert.match(hh, /date: 2099-01-02/);
    assert.match(hh, /内部调查/);
    assert.match(hh, /数字未确认/);
    const second = run();
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.equal(readFileSync(out1, 'utf8'), written);
    assert.match(second.stdout, /"overwrote": true/);
  } finally {
    rmSync(out1, { force: true });
    rmSync(out2, { force: true });
    if (!yearExisted) rmSync(year, { recursive: true, force: true });
    rmSync(inbox, { recursive: true, force: true });
  }
});

check('sensitive inbox files are skipped and left untouched', () => {
  const inbox = mkdtempSync(join(tmpdir(), 'kb-sensitive-'));
  const bot = join(inbox, '新闻影响');
  mkdirSync(bot);
  const srcPath = join(bot, '2099-01-03.md');
  const raw = '---\ntitle: "秘密"\nsource_bot: 新闻影响\nslot: daily\n---\n\n联系 qa-secret@example.com。监管已启动内部调查。\n';
  writeFileSync(srcPath, raw);
  const out = join(repo, 'content/news-impact/2099/2099-01-03-daily.md');
  try {
    const result = spawnSync(process.execPath, ['scripts/import-inbox.mjs', inbox], { cwd: repo, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /邮箱地址/);
    assert.equal(existsSync(out), false);
    assert.equal(readFileSync(srcPath, 'utf8'), raw);
  } finally {
    rmSync(out, { force: true });
    rmSync(inbox, { recursive: true, force: true });
  }
});

check('盘中 title writes an HHMM page', () => {
  assert.equal(fileClockOf('2026-11-16-1400.md'), '1400');
  assert.equal(fileClockOf('2026-11-16.md'), '');
  assert.equal(chooseOutputSlot('daily', {
    title: '2835 成分股日报 · 2026-11-16 14:00 盘中简版',
    clock: '1400',
    existingSource: '2835日报/2026-11-16-0900.md',
    sourceRel: '2835日报/2026-11-16-1400.md',
  }), '1400');
  assert.equal(chooseOutputSlot('pre', {
    title: '开盘前简报',
    clock: '0900',
    existingSource: '',
    sourceRel: '行情分析/2026-11-16-0900.md',
  }), 'pre');
  assert.equal(chooseOutputSlot('post', {
    title: '盘后简报',
    clock: '1800',
    existingSource: '',
    sourceRel: '行情分析/2026-11-16-1800.md',
  }), 'post');

  const inbox = mkdtempSync(join(tmpdir(), 'kb-mid-'));
  const bot = join(inbox, '新闻影响');
  mkdirSync(bot);
  writeFileSync(join(bot, '2099-08-01-1400.md'), [
    '# 新闻 盘中简版',
    '',
    '监管已启动内部调查，数字未确认。盘中权重近似贡献约 -1%。',
    '',
  ].join('\n'));
  const year = join(repo, 'content/news-impact/2099');
  const yearExisted = existsSync(year);
  const daily = join(year, '2099-08-01-daily.md');
  const page = join(year, '2099-08-01-1400.md');
  const run = () => spawnSync(process.execPath, ['scripts/import-inbox.mjs', inbox], { cwd: repo, encoding: 'utf8' });
  try {
    const first = run();
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.equal(existsSync(daily), false);
    const written = readFileSync(page, 'utf8');
    assert.match(written, /盘中简版/);
    assert.match(written, /slot: "1400"/);
    assert.match(written, /source: "新闻影响\/2099-08-01-1400.md"/);
    const second = run();
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.equal(readFileSync(page, 'utf8'), written);
    assert.match(second.stdout, /"overwrote": true/);
    assert.equal(existsSync(daily), false);
  } finally {
    rmSync(daily, { force: true });
    rmSync(page, { force: true });
    if (!yearExisted) rmSync(year, { recursive: true, force: true });
    rmSync(inbox, { recursive: true, force: true });
  }
});

check('different-source HHMM does not overwrite daily; same source updates in place', () => {
  assert.equal(chooseOutputSlot('daily', {
    title: '补充说明',
    clock: '1530',
    existingSource: '新闻影响/2099-08-02-0900.md',
    sourceRel: '新闻影响/2099-08-02-1530.md',
  }), '1530');
  assert.equal(chooseOutputSlot('daily', {
    title: '早报',
    clock: '0900',
    existingSource: '新闻影响/2099-08-02-0900.md',
    sourceRel: '新闻影响/2099-08-02-0900.md',
  }), 'daily');
  assert.equal(chooseOutputSlot('pre', {
    title: '开盘前',
    clock: '0915',
    existingSource: '行情分析/a-0900.md',
    sourceRel: '行情分析/b-0915.md',
  }), '0915');

  const inbox = mkdtempSync(join(tmpdir(), 'kb-guard-'));
  const bot = join(inbox, '新闻影响');
  mkdirSync(bot);
  writeFileSync(join(bot, '2099-08-02-0900.md'), [
    '# 早报',
    '',
    '监管已启动内部调查，数字未确认。这是早报全文。',
    '',
  ].join('\n'));
  const year = join(repo, 'content/news-impact/2099');
  const yearExisted = existsSync(year);
  const daily = join(year, '2099-08-02-daily.md');
  const page = join(year, '2099-08-02-1530.md');
  const run = () => spawnSync(process.execPath, ['scripts/import-inbox.mjs', inbox], { cwd: repo, encoding: 'utf8' });
  try {
    const first = run();
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const dailyOnce = readFileSync(daily, 'utf8');
    assert.match(dailyOnce, /早报全文/);
    assert.match(dailyOnce, /source: "新闻影响\/2099-08-02-0900.md"/);
    assert.match(dailyOnce, /slot: daily/);
    assert.equal(existsSync(page), false);

    writeFileSync(join(bot, '2099-08-02-1530.md'), [
      '# 补充说明',
      '',
      '监管已启动内部调查，数字未确认。这是另一份来源。',
      '',
    ].join('\n'));
    const second = run();
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.equal(readFileSync(daily, 'utf8'), dailyOnce);
    const alt = readFileSync(page, 'utf8');
    assert.match(alt, /补充说明/);
    assert.match(alt, /另一份来源/);
    assert.match(alt, /slot: "1530"/);
    assert.match(alt, /source: "新闻影响\/2099-08-02-1530.md"/);
    assert.doesNotMatch(readFileSync(daily, 'utf8'), /另一份来源/);

    const third = run();
    assert.equal(third.status, 0, third.stdout + third.stderr);
    assert.equal(readFileSync(daily, 'utf8'), dailyOnce);
    assert.equal(readFileSync(page, 'utf8'), alt);
    const imported = JSON.parse(third.stdout).imported;
    assert.equal(imported.find((row) => row.out.endsWith('2099-08-02-daily.md')).overwrote, true);
    assert.equal(imported.find((row) => row.out.endsWith('2099-08-02-1530.md')).overwrote, true);
  } finally {
    rmSync(daily, { force: true });
    rmSync(page, { force: true });
    if (!yearExisted) rmSync(year, { recursive: true, force: true });
    rmSync(inbox, { recursive: true, force: true });
  }
});

check('parses real git status -z', () => {
  const result = spawnSync('git', ['status', '--porcelain=v1', '-uall', '-z'], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const entries = parsePorcelainZ(result.stdout);
  assert.ok(entries.every((e) => e.path && !e.path.includes('\0')));
  assert.equal(parsePorcelainZ(' M scripts/sync-inbox.mjs\0')[0].path, 'scripts/sync-inbox.mjs');
});

check('failed import does not commit', () => {
  const missing = join(tmpdir(), 'kb-inbox-missing-t035');
  const result = spawnSync(process.execPath, ['scripts/sync-inbox.mjs', missing], { cwd: repo, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /not committing/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /npm run build/);
});

function trailingWs(s) {
  return s.match(/[ \t]*$/)[0];
}

/** output 必须是 source 删掉若干段之后的结果，不能改写留下来的字符。 */
function deletedPieces(source, output) {
  const pieces = [];
  let si = 0;
  for (let oi = 0; oi < output.length; oi++) {
    if (si < source.length && source[si] === output[oi]) { si++; continue; }
    const start = si;
    while (si < source.length && source[si] !== output[oi]) si++;
    if (si >= source.length) return null;
    pieces.push(source.slice(start, si));
    si++;
  }
  if (si < source.length) pieces.push(source.slice(si));
  return pieces;
}

check('preserves number commas and enumeration marks when a mid-sentence phrase is removed', () => {
  const src = '成交量 30,000 股、成交额 1,234.5 万，链接已 curl 核验为 HTTP 200，不能当作官方净值。';
  const out = cleanImportedBody(src);
  assert.equal(out, '成交量 30,000 股、成交额 1,234.5 万，不能当作官方净值。');
  assert.equal(out.includes('30，000'), false);
  assert.equal(out.includes('1，234.5'), false);
  const untouched = '成交量 30,000 股、成交额 1,234.5 万港元，不能当作官方净值。';
  assert.equal(cleanImportedBody(untouched), untouched);
  const mixed = '这不改写已收盘的约 -3.80%，但会进入周一开盘，光通信/PCB、大模型和国产 GPU 仍是最敏感环节。';
  assert.equal(cleanImportedBody(mixed), mixed);
});

check('preserves trailing spaces and drops HTML pointer sentences', () => {
  const label = '**光通信/PCB**（加权约 -9.96%，贡献约 -0.75pp）  ';
  assert.equal(cleanImportedBody(label), label);
  assert.equal(trailingWs(cleanImportedBody(label)), '  ');
  const withDrop = 'foo，链接已 curl 核验为 HTTP 200。  ';
  const dropped = cleanImportedBody(withDrop);
  assert.equal(dropped, 'foo。  ');
  assert.equal(trailingWs(dropped), '  ');
  const html = '上周五已完成收市。按已确认口径加权约 -3.80%。主线是成长回吐，组合跌幅大于恒指、也略深于恒科。详细价量表见 HTML。';
  assert.equal(
    cleanImportedBody(html),
    '上周五已完成收市。按已确认口径加权约 -3.80%。主线是成长回吐，组合跌幅大于恒指、也略深于恒科。',
  );
  assert.equal(cleanImportedBody('详细价量表见 HTML。'), '');
  assert.equal(cleanImportedBody('权重见 HTML。'), '');
  assert.equal(cleanImportedBody('详情见 HTML 主文件。'), '');
  assert.equal(cleanImportedBody('完整可搜可排序总表见 HTML 主文件。'), '');
});

check('keeps protected factual phrases', () => {
  const src = [
    '监管已启动内部调查，数字未确认。',
    '雅虎财经称讨论过回归，未经公司确认。',
    '该价格未确认。',
    '仅供参考，不构成投资建议。',
  ].join('\n');
  assert.equal(cleanImportedBody(src), src);
  assert.equal(
    cleanImportedBody('链接已 curl 核验为 HTTP 200，未经公司确认。'),
    '未经公司确认。',
  );
  assert.equal(
    cleanImportedBody('以上待确认，内部调查仍在继续，数字未确认。'),
    '内部调查仍在继续，数字未确认。',
  );
});

check('0900 fixture drops only the process spans', () => {
  const src = readFileSync(join(repo, 'scripts/fixtures/2026-11-16-0900.md'), 'utf8');
  const out = cleanImportedBody(src);
  const drops = [
    '完整权重复核放在今日 18:00 完整版。',
    '完整可搜可排序总表见 HTML 主文件。',
    '链接已 curl 核验为 HTTP 200。',
    '详细价量表见 HTML。',
  ];
  for (const sentence of drops) assert.equal(out.includes(sentence), false, sentence);
  assert.equal(out.includes('30,000'), true);
  assert.equal(out.includes('30，000'), false);
  assert.match(out, /未经公司确认/);
  assert.match(out, /仅供参考，不构成投资建议。/);
  assert.equal(cleanImportedBody(out), out);

  const srcLines = src.split('\n');
  const outLines = out.split('\n');
  const rebuilt = [];
  for (const line of srcLines) {
    if (line.trim() === '') { rebuilt.push(''); continue; }
    const alone = cleanImportedBody(line);
    if (alone === '') continue;
    const removed = deletedPieces(line, alone);
    assert.notEqual(removed, null, `rewrote a kept line:\n${JSON.stringify(line)}\n${JSON.stringify(alone)}`);
    assert.equal(trailingWs(alone), trailingWs(line), JSON.stringify(line));
    rebuilt.push(alone);
  }
  let rebuiltText = rebuilt.join('\n');
  rebuiltText = rebuiltText.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
  assert.equal(rebuiltText, out);
  assert.equal(outLines.length, rebuilt.length);
});

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('all clean checks passed');
