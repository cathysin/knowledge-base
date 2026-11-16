# T035 收件箱自动同步

脚本和配置改动先等 QA。通过之前，不要在盒子上打开 `--commit --push`。

## 触发

盒子上的例行任务盯着收件箱（本机目录，例如 `/workspace/work/IT/knowledge-inbox/`）。它调用 `scripts/sync-inbox.mjs`，不经过 GitHub Actions。

不要加一个去读这个目录的 GitHub Action。Actions 的 runner 看不见盒子上的 `/workspace/work/IT/knowledge-inbox/`。

## 每次跑什么

1. `scripts/import-inbox.mjs` 读取收件箱，清洗正文，再写入 `content/`。
2. `npm run build`（Astro、表格处理、Pagefind、`verify-dist`）。
3. 构建失败：退出非 0，不提交，不推送。
4. `content/` 没有变化：退出 0，打印 `no new content`。
5. `content/` 有变化，但工作区里还有 `content/` 以外的改动：中止，不提交。
6. 只有 `content/` 变了：打印文件列表和建议的提交说明。默认到此为止（试跑，不提交、不推送）。`--commit` 只提交 `content/`。再加上 `--push` 才推送当前分支。盒子上的检出应是 `main`。

导入失败（打不开收件箱，或有文件因敏感信息被跳过）也是非 0 退出，不构建，不提交，不推送。

推送成功之后：

- GitHub Pages 已经会在推到 `main` 时部署，见 `.github/workflows/deploy.yml`。构建失败则 deploy 不会跑。这个工作流不用改。
- Vercel 还没连接。仓库里的 `vercel.json` 已是 Astro、`buildCommand` 为 `npm run build`、`outputDirectory` 为 `dist`。等 Vercel 项目连上这个仓库之后，同一次推 `main` 会再部署一份。现在不要改 Vercel 设置。

## 清洗

只清洗即将写入 `content/` 的正文。不修改收件箱里的原件。同一输出路径再跑一次会覆盖，不另加文末免责声明。

去掉这些流程用语：

- 「仅供内部参考」。句子里剩下的「不构成投资建议」保留。
- 「待 Cathy 确认」「对外口径待 Cathy 确认」「以上均待 Cathy 确认」「以上待确认」，以及正文里同类的 Cathy 流程说明。
- 标题里的「（待确认）」「（待 Cathy 确认）」，例如「## 今日结论（待确认）」写成「## 今日结论」。
- 「完整权重复核放在今日 18:00 完整版。」
- 「完整可搜可排序总表见 HTML 主文件。」
- 「链接已 curl 核验为 HTTP 200。」
- 「详细价量表见 HTML。」以及整句把读者指到 HTML 文件或表的「…见 HTML。」「…见 HTML 主文件。」
- 同类句子：指向「HTML 主文件」或「见 HTML」、curl / 本机核验、把完整表或完整复核推到「今日 18:00 完整版」。

删掉一个短语或句子时，只去掉这段文字，以及紧挨着它的一个分隔符（， 、 , ； 这类）。同一行里其余文字保持原样，不把 ， 和 、 互相改写，不把数字里的英文逗号（`30,000`、`1,234.5`）换成中文逗号，也不裁掉留下来的行尾空格（Markdown 硬换行）。

留下这些：

- 「仅供参考，不构成投资建议」这类对外口径。
- 新闻事实里的「内部调查」「数字未确认」「未确认」「未经公司确认」，以及「待核实」。

文件名认 `YYYY-MM-DD.md` 和 `YYYY-MM-DD-HHMM.md`。日期用前 10 位。命中邮箱、密钥、账户号、客户字段或内网网址的文件整篇不导入。正文里的 `/workspace/` 等本机路径整句删掉。

## 怎么跑

在仓库根目录：

```bash
node scripts/test-import-clean.mjs
# 或
npm run test:clean

# 试跑：导入、清洗、构建，不提交、不推送
node scripts/sync-inbox.mjs /workspace/work/IT/knowledge-inbox

# 只提交 content/，不推送
node scripts/sync-inbox.mjs /workspace/work/IT/knowledge-inbox --commit

# QA 通过之后，盒子例行任务才用：提交并推送当前分支
node scripts/sync-inbox.mjs /workspace/work/IT/knowledge-inbox --commit --push
```

不写路径时，收件箱仍是仓库上一级的 `../knowledge-inbox`。路径按运行命令时的当前目录解析，再传给导入脚本。

## 日志

脚本只写标准输出和标准错误，不在仓库里建日志文件，避免日志被提交。盒子上的例行任务把输出追加到仓库外面，例如：

`/workspace/work/IT/logs/knowledge-base-sync.log`

构建失败、导入失败或中止时，这条日志里会有 `not committing`。有 `content/` 变化但没加 `--commit` 时，会有 `dry run: no commit, no push`。

## 失败时不要推

导入失败或 `npm run build` 失败，脚本以非 0 退出，不会 `git commit`，也不会 `git push`。已经写进工作区的 `content/` 文件留在原地，方便查看，但不会进入 `main`，因此也不会触发 GitHub Pages，更不会触发尚未连接的 Vercel。
