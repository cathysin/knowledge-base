# 交接说明（T011 简版，全文下轮再补）

技术栈：Astro 7 纯静态 + Pagefind 1.6。部署到 GitHub Pages 项目站 `https://cathysin.github.io/knowledge-base/`（`site`: `https://cathysin.github.io`，`base`: `/knowledge-base/`）。CI：`.github/workflows/deploy.yml`，推 `main` 或手动触发；构建失败不部署。

目录：正式文章在 `content/`（现仅 `.gitkeep`）。页面在 `src/pages/`（首页、分类、文章/年份、搜索、404 → `dist/404.html`）。站内链接一律走 `src/lib/base.ts` 的 `withBase()`。18 篇示例已移到 `_drafts-examples/content/`，已 gitignore，不上线。

front matter 必填：`title`、`date`、`category`（六个 slug 之一）、`source_bot`、`slot`、`summary`（1–120 字）、`compliance_checked: true`。正文不能空。文件名：`content/<slug>/<YYYY>/<YYYY-MM-DD>-<slot>.md`。

脚本：`npm run build` = `astro build` → `enhance-tables.mjs` → `pagefind --site dist` → `verify-dist.mjs`。`KB_EMPTY` 仅自检用。

已知问题：Firefox 不支持 `text-wrap: pretty`；Firefox 320px 下首页标题可能出现「Cathy's Know- / ledge Base」。

下轮修（QA T005-C v2，等 T012-B 后一起修）：① 搜索「港股」混进分类页和元数据；② 面包屑「首页」宽不足 44；③「回到最新列表」点击区域偏小；④「AI 情报」宽约 43.8px；⑤ 分类名空格不一致；⑥ 表格隐藏标题都是「数据表」；⑦ 同 Firefox pretty。

还没做：T012-B 导入 inbox（先试跑 `每日推送/2026-11-15.md`）。自动推送要先整体过 QA；构建失败不推；自动提交只改内容目录。

上线清单：构建通过且有 `dist/404.html`；Pages 来源设为 GitHub Actions（仓库目前 `has_pages=false`，不设可能部署失败）；免责声明「仅个人学习笔记，不构成投资建议」需合规审查后再正式对外；不推示例、密钥、备份和 `_selfcheck/`。
