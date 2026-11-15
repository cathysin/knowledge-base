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

## 本轮（T013）：11-08 ~ 11-14 按日期补齐（真实数据）

背景：这批日期的原始推送未留档，本地与 git 历史均无原文。处理办法是**按日期检索公开信源重建**，不保留任何示例占位。全部文章不含 `sample` 标记，正文与表格均为可核对的真实数据。

数据来源（每篇文末都带链接）：

- 港股收盘：新华社每日「港股X日涨/跌X%」，指数由交易所收盘数据核对
- 隔夜美股：新华社「纽约股市三大股指X日」，附 WTI/布伦特/美元指数
- 新闻与政策：新华财经早报、新浪财经周末资讯回顾、华尔街见闻早餐、财联社
- 新股：东方财富港股IPO周报、智通财经配发结果、etnet 上市新股表、证券时报
- ETF：MoneyDJ 净值与市价、etnet / aastocks 的 02835 报价

共 36 篇：

| 分类 | 日期范围 | 篇数 | 说明 |
| --- | --- | ---: | --- |
| cm-knowledge | 11-09 ~ 11-13 | 5 | 工作日推送，周末不发；内容是货币市场基金系列 1.1.2–1.1.6 |
| market-brief | 11-09 ~ 11-13 | 5 | 开盘前（`pre`），含前一交易日港股收盘与隔夜美股 |
| news-impact | 11-08 ~ 11-14 | 7 | 含周末，每条附板块与方向 |
| ai-intel | 11-08 ~ 11-14 | 7 | 含周末，按 Anthropic IPO / Fable 5.2 / 英伟达人事主线 |
| etf-2835 | 11-08、09、12、13、14 | 5 | 11-10 与 11-11 当日 ETF 报价未查到，**已删除，不留占位** |
| hk-ipo | 11-08 ~ 11-14 | 7 | 本周 7 只新股逐日记录，含认购倍数与累计表现 |

口径说明：11-08（周日）与 11-14（周六）港股休市，market-brief 不出；ETF 与新股这两天写成"沿用上一交易日收盘"的复盘，不编造盘中数据。

**缺口**：etf-2835 的 11-10、11-11 两篇缺失；若要补，需要当日的 02835 市价与净值，可在 MoneyDJ 历史净值表查到后照同样的结构补回。

## 已知问题

Firefox 不支持 `text-wrap: pretty`；Firefox 320px 下首页标题可能出现「Cathy's Know- / ledge Base」。

下轮修（QA T005-C v2）：① 搜索「港股」混进分类页和元数据；② 面包屑「首页」宽不足 44；③「回到最新列表」点击区域偏小；④「AI 情报」宽约 43.8px；⑤ 分类名空格不一致；⑥ 表格隐藏标题都是「数据表」；⑦ 同 Firefox pretty。

还没做：自动推送流水线（先整体过 QA；构建失败不推；自动提交只改内容目录）。

## 上线清单

构建通过且有 `dist/404.html`；Pages 来源设为 GitHub Actions（仓库目前 `has_pages=false`，不设可能部署失败）；免责声明「仅个人学习笔记，不构成投资建议」需合规审查后再正式对外；不推示例、密钥、备份和 `_selfcheck/`。
