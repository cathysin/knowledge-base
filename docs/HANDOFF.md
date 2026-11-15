# 交接说明（T013）

## 协作流程（每次改动都走一遍）

1. `git pull --rebase origin main` —— 先拉最新（多人同推 main，避免 merge 提交污染历史）
2. 改完本地跑 `npm run build` —— 构建失败 CI 不部署，别把站点推挂
3. 提交后更新本文件（HANDOFF.md）—— 写清本轮做了什么、还欠什么
4. `git push`，推完确认 GitHub Actions 绿

## 技术栈

Astro 7 纯静态 + Pagefind 1.6。部署到 GitHub Pages 项目站 `https://cathysin.github.io/knowledge-base/`（`site`: `https://cathysin.github.io`，`base`: `/knowledge-base/`）。CI：`.github/workflows/deploy.yml`，推 `main` 或手动触发；构建失败不部署。

## 目录

正式文章在 `content/<slug>/<YYYY>/`。页面在 `src/pages/`（首页、分类、文章/年份、搜索、404 → `dist/404.html`）。站内链接一律走 `src/lib/base.ts` 的 `withBase()`。18 篇示例已移到 `_drafts-examples/content/`，已 gitignore，不上线。

front matter 必填：`title`、`date`、`category`（六个 slug 之一）、`source_bot`、`slot`、`summary`（1–120 字）。`compliance_checked` 已于 T012-B 改为可选（导入的推送没过合规审查，不写）。正文不能空。文件名：`content/<slug>/<YYYY>/<YYYY-MM-DD>-<slot>.md`。

## 内容入库（T012-B）

`scripts/import-inbox.mjs` 把 `../knowledge-inbox/<bot 名>/<YYYY-MM-DD>.md` 导入 `content/`。

- bot → 分类：`每日推送→cm-knowledge`、`行情分析→market-brief`、`新闻影响→news-impact`、`2835日报→etf-2835`、`港股IPO→hk-ipo`、`每日AI情报→ai-intel`
- 日期取自**文件名**；`slot` 取 front matter，否则按标题判断（盘前→`pre`、盘后→`post`、其余→`daily`）
- 摘要取 front matter `summary`，超过 120 字或缺失则从正文首段自动提取
- 命中敏感信息（邮箱／密钥／账户号／客户字段／内网网址）的文件不导入，脚本以非 0 退出
- 幂等：同名覆盖；只写 `content/`，不删文件
- 收件箱默认读仓库同级的 `../knowledge-inbox/`（本机已建好 6 个 bot 子目录）
- 正文里含本机路径（`/workspace/`、`/Users/` 等）的句子会在导入时整句删掉；删完仍残留路径的文件不导入（T011-r1）

## 本轮（T013）：11-08 ~ 11-14 结构补录

背景：这批日期的原始推送**从未留档**，本地与 git 历史均无原文。按 Cathy 要求补全日期与版式，因此 38 篇全部：

- 标 `sample: true` —— 站点列表里日期位置显示「示例」，不冒充真实历史
- 正文首行统一注明「结构补录，数字为示意值」；表格里数据位留 `—`，未编造任何点位、涨跌幅、成分股名单或 IPO 明细
- 已提交的是**结构真实、数字空缺**的版本

补录明细（共 38 篇）：

| 分类 | 日期范围 | 篇数 | 说明 |
| --- | --- | ---: | --- |
| cm-knowledge | 11-09 ~ 11-13 | 5 | 工作日推送，周末不发，故不含 11-08／11-14 |
| market-brief | 11-09 ~ 11-13 | 5 | 仅开盘前（`pre`）档 |
| news-impact | 11-08 ~ 11-14 | 7 | 含周末 |
| ai-intel | 11-08 ~ 11-14 | 7 | 含周末 |
| etf-2835 | 11-08 ~ 11-14 | 7 | 周末标休市 |
| hk-ipo | 11-08 ~ 11-14 | 7 | 周末标无新增 |

**待办决策**：这批 `sample: true` 文章要不要上线。现状是公开站点会显示「示例」。若不想露出，两种处理：① 拿到真实推送后覆盖同名文件并删 `sample` 行；② 直接删掉这 38 个文件。

## 已知问题

Firefox 不支持 `text-wrap: pretty`；Firefox 320px 下首页标题可能出现「Cathy's Know- / ledge Base」。

下轮修（QA T005-C v2）：① 搜索「港股」混进分类页和元数据；② 面包屑「首页」宽不足 44；③「回到最新列表」点击区域偏小；④「AI 情报」宽约 43.8px；⑤ 分类名空格不一致；⑥ 表格隐藏标题都是「数据表」；⑦ 同 Firefox pretty。

还没做：自动推送流水线（先整体过 QA；构建失败不推；自动提交只改内容目录）。

## 上线清单

构建通过且有 `dist/404.html`；Pages 来源设为 GitHub Actions（仓库目前 `has_pages=false`，不设可能部署失败）；免责声明「仅个人学习笔记，不构成投资建议」需合规审查后再正式对外；不推示例、密钥、备份和 `_selfcheck/`。
