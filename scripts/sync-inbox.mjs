// T035：盒子上的例行任务以后调用这个脚本。默认只试跑，不提交、不推送。
// 用法：
//   node scripts/sync-inbox.mjs [收件箱目录] [--commit] [--push]
// 收件箱默认仍是仓库上一级的 ../knowledge-inbox（由 import-inbox.mjs 解释）。
// 顺序：导入并清洗 → npm run build → 只有 content/ 有变化才允许提交。
// 构建失败、导入失败，或工作区里还有 content/ 以外的改动，都不提交、不推送。
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');

export function parseArgs(argv) {
  let inbox;
  let commit = false;
  let push = false;
  for (const a of argv) {
    if (a === '--commit') commit = true;
    else if (a === '--push') push = true;
    else if (a === '--dry-run') { /* 默认就是试跑 */ }
    else if (a.startsWith('-')) throw new Error(`unknown flag: ${a}`);
    else if (inbox) throw new Error('only one inbox path');
    else inbox = a;
  }
  if (push && !commit) throw new Error('--push requires --commit');
  return { inbox, commit, push };
}

export function isContentPath(p) {
  if (!p) return false;
  const norm = String(p).replaceAll('\\', '/').replace(/^\.\//, '');
  if (norm.split('/').includes('..')) return false;
  return norm === 'content' || norm.startsWith('content/');
}

/** git status --porcelain=v1 -z。重命名记录是「XY 新路径\\0旧路径\\0」。 */
export function parsePorcelainZ(text) {
  const parts = String(text).split('\0');
  if (parts.length && parts[parts.length - 1] === '') parts.pop();
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    if (!rec || rec.length < 4) continue;
    const status = rec.slice(0, 2);
    const path = rec.slice(3);
    let from;
    if (status.includes('R') || status.includes('C')) from = parts[++i];
    entries.push({ status, path, from });
  }
  return entries;
}

export function classifyChanges(entries) {
  const content = [];
  const outside = [];
  for (const e of entries) {
    const paths = [e.path, e.from].filter(Boolean);
    const outsider = paths.find((p) => !isContentPath(p));
    if (outsider) outside.push(outsider);
    for (const p of paths) if (isContentPath(p)) content.push(p);
  }
  if (!content.length) return { kind: 'none', content, outside };
  if (outside.length) return { kind: 'abort', content, outside };
  return { kind: 'content', content, outside };
}

export function suggestCommitMessage(files) {
  const subject = `content: 导入收件箱更新（${files.length} 个文件）`;
  const body = files.map((f) => `- ${f}`).join('\n');
  return { subject, body, text: `${subject}\n\n${body}` };
}

function git(args, { inherit = false } = {}) {
  return spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    fail(err.message, 2);
  }

  const top = git(['rev-parse', '--show-toplevel']);
  if (top.status !== 0) fail('not a git repo; not committing');
  if (resolve(top.stdout.trim()) !== resolve(ROOT)) fail('git toplevel is not this repo; not committing');

  const inboxLabel = args.inbox ?? '(default ../knowledge-inbox)';
  console.log(`sync-inbox: import ${inboxLabel}`);
  const importArgs = [resolve(ROOT, 'scripts/import-inbox.mjs')];
  if (args.inbox) importArgs.push(resolve(args.inbox));
  const imported = spawnSync(process.execPath, importArgs, { cwd: ROOT, stdio: 'inherit' });
  if ((imported.status ?? 1) !== 0) fail('import failed: not committing', imported.status || 1);

  console.log('sync-inbox: npm run build');
  const built = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if ((built.status ?? 1) !== 0) fail('build failed: not committing, not pushing', built.status || 1);

  const status = git(['status', '--porcelain=v1', '-uall', '-z']);
  if (status.status !== 0) fail(status.stderr || 'git status failed; not committing');
  const cls = classifyChanges(parsePorcelainZ(status.stdout));

  if (cls.kind === 'none') {
    console.log('no new content');
    if (cls.outside.length) {
      console.log('other working tree changes were left uncommitted:');
      for (const p of cls.outside) console.log(`- ${p}`);
    }
    process.exit(0);
  }
  if (cls.kind === 'abort') {
    console.error('abort: changes outside content/ would be committed:');
    for (const p of cls.outside) console.error(`- ${p}`);
    console.error('not committing');
    process.exit(1);
  }

  const message = suggestCommitMessage(cls.content);
  console.log('content changed:');
  for (const f of cls.content) console.log(`- ${f}`);
  console.log('suggested commit message:');
  console.log(message.text);

  if (!args.commit) {
    console.log('dry run: no commit, no push');
    process.exit(0);
  }

  const added = git(['add', '--', ...cls.content]);
  if (added.status !== 0) fail(added.stderr || 'git add failed; not committing');
  const cached = git(['diff', '--cached', '--name-only', '-z']);
  if (cached.status !== 0) fail(cached.stderr || 'git diff failed; not committing');
  const staged = cached.stdout.split('\0').filter(Boolean);
  if (staged.some((p) => !isContentPath(p))) {
    git(['reset', '-q', 'HEAD', '--', ...staged]);
    fail('abort: index contains paths outside content/; not committing');
  }
  if (!staged.length) {
    console.log('no new content');
    process.exit(0);
  }

  const committed = git(['commit', '-m', message.subject, '-m', message.body], { inherit: true });
  if ((committed.status ?? 1) !== 0) fail('commit failed; not pushing', committed.status || 1);
  if (!args.push) {
    console.log('committed, not pushing');
    process.exit(0);
  }
  const pushed = git(['push', 'origin', 'HEAD'], { inherit: true });
  if ((pushed.status ?? 1) !== 0) fail('push failed: commit is local only', pushed.status || 1);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirect) main();
