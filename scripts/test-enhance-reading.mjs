import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir = mkdtempSync(join(tmpdir(), 'reading-layout-'));
try {
  const path = join(dir, 'index.html');
  const source = '<article><h1>测试标题</h1><div class="prose"><ul><li>日期：2026-11-16（星期一）</li></ul><p>测试标题（星期一）</p><p>结论：保留 23,753.84 和<a href="https://example.org">来源</a>。</p><p>来源：原文。</p><table><tr><td>数据</td></tr></table></div><div class="article-reading-end"></div></article>';
  writeFileSync(path, source);
  const run = () => { const result = spawnSync(process.execPath, ['scripts/enhance-reading.mjs', dir], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); };
  run();
  const output = readFileSync(path, 'utf8');
  assert.match(output, /<p hidden data-pagefind-ignore="all">测试标题（星期一）<\/p>/);
  assert.match(output, /<p class="article-keypoint">结论：保留 23,753\.84 和<a href="https:\/\/example\.org">来源<\/a>。<\/p>/);
  assert.match(output, /<p class="article-source-note">来源：原文。<\/p>/);
  assert.ok(output.includes('<table><tr><td>数据</td></tr></table>'));
  run(); assert.equal(readFileSync(path, 'utf8'), output);
  writeFileSync(path, source.replace('日期：2026-11-16（星期一）', '日期：2026-11-16'));
  run(); assert.ok(readFileSync(path, 'utf8').includes('<p>测试标题（星期一）</p>'));
  console.log('reading enhancement: information, links, tables and idempotence passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
