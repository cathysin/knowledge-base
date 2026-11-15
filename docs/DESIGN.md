# 网站改版 DESIGN.md

## 当前生效：全站改版 v7（2026-11-15）

用户在本次会话确认新版预览，并明确要求「首页动效只保留流动光场。然后推main」。本节为此次已确认的新设计；下方 v5 与 T005 方案保留作为历史记录，发生视觉冲突时以本节为准。

- 首页：深色首屏、银蓝 Three.js 流动光场、真实文章搜索、六主题联动、最近更新与主题入口。只保留光场，删除星图和效果切换。
- 内页：白色阅读面、深色正文、蓝色当前链接；分类侧栏、年份/时点过滤、统一归档列表、摘要和来源统一层级。
- 主色：背景 `#fff`，文字 `#17191d`，次级文字 `#646b75`，强调 `#0059d6`，分隔 `#e3e6eb`，浅底 `#f5f6f8`。首页背景 `#0b1018`。
- 桌面版心 1080–1240px；正文约 880px 居中单栏，不设右侧目录。手机单列、折叠目录、宽表格在容器内滑动，保持数字清晰。
- 动效只服务首页探索和轻量反馈。提供暂停/复位、系统减少动态效果、后台/离屏停帧与无 WebGL 降级。
- 保留 Astro 原生静态 URL、base 路径、课程编号排序与真实 Pagefind 搜索。正文和表格数据不由设计代码改写。

补充确认：用户后续要求资本管理分类及子页面与其他页面统一，并取消正文右侧索引；所有分类使用统一归档列表，所有文章使用同一单栏阅读模板。

---

本文件分两部分：
- 第一部分「设计规范」是 IT 线唯一的规范来源，只由「设计规范」bot 维护，改动须经 Cathy 确认（经派发卡）。其他 bot 不改这一部分。
- 第二部分「设计方案」由设计总监写，必须遵守第一部分。

---

## 第一部分：设计规范（唯一来源）

版本：v5（2026-11-15）

修订记录：
- v5（2026-11-15）：C-014、C-016，Cathy 21:28 确认（原话「可以，按你的建议来 不要总问我」）。第 7 节禁用清单下加了一条例外：只在本地原型阶段可以暂留标明「示例」的占位内容；第 9 节加了一条例外：纯静态页可以不做加载态和报错态。原有条目都没删。
- v4（2026-11-15）：T007，Cathy 确认（原话「按照建议就行 加快进度」；C-004 知识库首页用版 2，C-005 选 b）。第 3 节在原六档之外加了大标题专用的「展示档」（数值取自 T005-design.md 2.3 节的 Apple 实测），并规定大标题行高 1.2；第 4 节加 64、96 两档间距；第 5 节加输入框圆角 8px；第 10 节验收表同步。原有条目都没删，原六档字号不变。
- v3（2026-11-15）：C-001，Cathy 定了 T006 的 7 处冲突（原话「照建议」，即 1B 2C 3A 4A 5A 6A 7B），写进对应条目，没删任何条目：第 2 节加「只做浅色」；第 3 节字号改用 rem 写（数值不变），不用流式字号；第 6 节加可交互控件边框对比度 ≥3:1；第 7 节写明加载态也不开渐变例外；第 8 节加 320px 宽和 200% 文字放大抽查；第 10 节验收表同步；11.2 第 5 条定为用浏览器自带焦点框；第 11 节开头的「待定」说明改掉。
- v2（2026-11-15）：任务卡 T006，Cathy 确认。新增第 11 节「现代网页做法」，内容摘自 Chrome 官方 modern-web-guidance 仓库中适用于我们网站和前端原型的条目，用于补齐页面骨架、无障碍、图片性能、排版、动效、状态写法等方面的规则。第 1–10 节一字未改；与现有条目有出入的指南内容没有写进来，已列成冲突清单交派，待 Cathy 定。
- v1（2026-11-15）：由设计总监、前端工匠、设计评审、QA 原设置里的规范合并而成。

### 1. 风格
DJI / 腾讯浅色风。干净、留白、细边框加极淡阴影。只用旧版真实文案和图片。

### 2. 颜色
| 用途 | 值 |
|---|---|
| 背景 | 白 #FFFFFF |
| 主文字（墨色） | #111111 |
| 次要文字 | #666666 |
| 强调色：腾讯蓝 | #0052D9，只用于主按钮和当前链接，其他地方不用 |

只做浅色，不做深色模式；在 `:root` 上声明 `color-scheme: light`。（v3，C-001）

### 3. 字号
只用 12 / 14 / 16 / 20 / 28 / 36 px。

代码里用 rem 写，对应 0.75 / 0.875 / 1 / 1.25 / 1.75 / 2.25 rem（浏览器默认设置下算出来正好是上面六档 px，QA 照旧抽查计算样式 font-size）。不用 `clamp()` 之类随屏宽缩放的流式字号：1280px 和 390px 两档各从这六档里选固定字号。（v3，C-001）

**展示档（v4，T007）**：只给大标题区用（首屏大标题、副标题、分类名、分类说明），正文、导航、按钮、页脚等其他文字仍只用上面六档。展示档同样每档宽度用固定字号，不用流式字号。

| 用途 | 1280px | 390px |
|---|---|---|
| 首屏大标题（H1） | 3.5rem（56px） | 2rem（32px） |
| 首屏副标题 | 1.75rem（28px，即原六档的 28） | 1.1875rem（19px） |
| 分类名 | 2.5rem（40px） | 2rem（32px） |
| 分类说明 | 1.3125rem（21px） | 1.1875rem（19px） |

大标题（H1 和分类名）行高 1.2（无单位写法）。

### 4. 间距
只用 4 / 8 / 16 / 24 / 32 / 48 / 64 / 96 px。（64、96 两档为 v4 新增，T007，用于大块留白）

### 5. 圆角
- 按钮 8px
- 输入框 8px（v4，T007）
- 卡片 12px

### 6. 边框与阴影
细边框加极淡阴影。不用重阴影。

可交互控件（输入框、按钮、下拉框等）的边框对背景对比度至少 3:1（白底上约 #949494 或更深）；纯展示的卡片、分隔线可以保持浅色细边框。具体色值由设计方案定，用前先算对比度。（v3，C-001）

### 7. 禁用清单
- 紫蓝渐变（以及任何渐变；加载态也不开例外，用原生 `<progress>` 或纯色，见 11.8）
- 大面积黑色头图
- 深色工具栏
- 居中主视觉加 3 张等大卡片的通用版式
- 标题上的小徽章
- 表情符号
- 占位文字、假姓名、假数据
- 与内容不符的配图

例外（v5，C-016）：只在本地原型、既不推送也不部署的时候，允许暂时保留标明「示例」的占位内容；推到 GitHub 或部署上线之前，必须清掉或换成真实内容。

### 8. 响应式
每页都要说明并实现 1280px 和 390px 两种宽度，不允许溢出、截断或横向滚动。

另加两项抽查：320px 宽时不出现横向滚动；把文字放大到 200% 时内容不丢、不被截断。（v3，C-001）

### 9. 状态
每个页面都要有空状态、加载状态和报错状态。

例外（v5，C-014）：纯静态、不请求数据的页面可以不做加载态和报错态，但要在设计方案里写明原因；空状态照旧要做。

### 10. 验收时怎么查（设计评审看方案和截图，QA 实测）
| 项目 | 设计评审 | QA 实测方法 |
|---|---|---|
| 颜色（含腾讯蓝使用范围） | 查 | 抽查计算样式里的 color / background-color |
| 字号 | 查 | 抽查计算样式 font-size |
| 展示档字号只用在大标题区、大标题行高 1.2 | 查 | 抽查大标题区计算样式 font-size / line-height，并确认正文等没用展示档 |
| 间距 | 查 | 抽查计算样式 margin / padding / gap |
| 圆角 | 查 | 抽查计算样式 border-radius |
| 边框与阴影 | 查 | 抽查计算样式 border / box-shadow |
| 禁用清单 | 逐条查 | 截图逐条核对 |
| 响应式 1280 / 390 | 查说明 | 两种宽度各截图，查溢出和横向滚动 |
| 320px 宽、文字放大 200% | 查说明 | 320px 宽截图查横向滚动；浏览器文字放大到 200% 截图查内容是否丢失或截断 |
| 边框对比度（可交互控件 ≥3:1） | 查 | 抽查控件边框色并算对比度 |
| 空 / 加载 / 报错态 | 查说明 | 实际触发并截图 |

### 11. 现代网页做法（摘自 Chrome modern-web-guidance）
来源：https://github.com/GoogleChrome/modern-web-guidance （commit 4dd96834，2026-11-10），只摘适用于我们网站和前端原型的条目。每条后面括号里是来源文件（都在仓库 `skills/modern-web-guidance/guides/` 下）。本节只做补充：和第 1–10 节有出入时，以第 1–10 节为准。T006 列出的 7 处出入已由 Cathy 在 C-001 定下，v3 写进了对应各节。

**11.1 页面骨架**
1. 每页开头用 `<!DOCTYPE html>`，`<html lang="zh-CN">`（按页面实际语言填），并写 `<meta name="viewport" content="width=device-width, initial-scale=1">`；不许禁止用户缩放。（html/html.md）
2. 每页一个独有的 `<title>`，格式「页面主题 | 网站名」，不许空标题、不许多页同名。（accessibility/accessibility.md §4）
3. 页面分区用 `<header>` `<nav>` `<main>` `<aside>` `<footer>`，每页只有一个 `<main>`；有多个 `<nav>` 时各给一个不同的 `aria-label`（名字里不要再写"导航"二字）。（accessibility.md §1）
4. 每页一个 `<h1>`，标题级别按顺序往下（h2→h3，不跳级）；不许用 `<div>`/`<span>` 假装标题。（accessibility.md §1，html.md）
5. 列表内容用 `<ul>`/`<ol>`；表格只放数据，带 `<caption>` 和 `<th scope>`，不许用表格排版。（accessibility.md §1）
6. 顶部导航前放一个"跳到正文"链接，平时隐藏、键盘 Tab 到时出现。（accessibility.md §1）
7. 当前页的导航链接加 `aria-current="page"`，样式用它来挂（即第 2 节"当前链接用腾讯蓝"的那个链接）。（ui-components/navbar.md）

**11.2 按钮、链接与键盘**
1. 点了在本页做事的用 `<button>`，点了去别的地址的用 `<a href>`；不许用 `<div>` 加点击事件冒充按钮。（html.md，user-experience/natural-interactions.md）
2. 只有图标的按钮必须有文字名字（`aria-label` 或隐藏文字），纯装饰图标加 `aria-hidden="true"`。（user-experience/form-factor-adaptation.md）
3. 同一页里指向不同地址的链接不要用同一句文字（如两个"了解更多"）；按钮上看得见的字要原样出现在它的无障碍名字里。（accessibility.md §3）
4. 只用 Tab / Shift+Tab / Enter / 空格 / Esc 就能走完并操作页面上所有东西，焦点不会卡住；不许用正数 `tabindex`；不要用 CSS `order` 或 `*-reverse` 打乱可点元素的顺序。（accessibility.md §5、§13，css/css-layout.md）
5. 焦点框优先用浏览器自带的；不许只写 `outline: none` 而不给替代焦点框。焦点框用浏览器自带的，不自定义颜色。（v3，C-001）（accessibility.md §5）
6. 可点区域至少 24×24px，在触屏上（390px 那档）至少 44×44px；用 `min-block-size`/`min-inline-size` 或内边距撑，不用写死的宽高。句子里的文字链接不受限。（accessibility.md §5，form-factor-adaptation.md）
7. 每个可点控件的悬停、按下、键盘焦点三种状态要看得出区别；悬停时才出现的内容，键盘聚焦时也要出现，没有悬停的设备上默认就显示。悬停效果遵守第 6 节（不用重阴影），不要照抄指南示例里的阴影值。（natural-interactions.md）
8. 下拉菜单可以悬停打开，但不能"只能"悬停打开：点击、触摸、键盘也要能开，按 Esc 能关。（natural-interactions.md）

**11.3 图片与媒体**
1. 每张 `<img>` 都要有 `alt`：有意义的图写它的用途（不写"图片："这类前缀），装饰图写 `alt=""`。（accessibility.md §6）
2. 每张图写 `width` 和 `height`（或 CSS `aspect-ratio`），先占好位置，加载时页面不跳。（html.md §3，css/responsive-design.md）
3. 首屏最大的那张图（头图）不许 `loading="lazy"`，可以加 `fetchpriority="high"`（只给这一张）；首屏以下的图加 `loading="lazy"`。（html.md §3，performance/performance.md）
4. 同一张图准备多种尺寸时用 `srcset` 配 `sizes`（不许只写 `srcset` 不写 `sizes`）；优先用 AVIF / WebP，`<picture>` 里留 JPEG/PNG 兜底。（performance.md）
5. 图片和视频不许超出所在栏：`max-inline-size: 100%; block-size: auto`。（form-factor-adaptation.md）
6. 不许自动播放有声音的媒体；会自己动、超过 5 秒、和其他内容一起显示的东西（轮播、动画横幅）要有看得见、键盘能按的"暂停"按钮。视频要有字幕。（html.md §8，ui-behaviors/motion.md，accessibility.md §6）

**11.4 文字排版**
1. 正文一行不超过约 80 个字符宽（如 `max-width: 60ch`），行高用无单位数值（如 1.5）。（visual-design/typography.md）
2. 不用两端对齐（`text-align: justify`）；不用花体字做正文；强调用加粗，不用全大写，强调别到处用。（typography.md）
3. 短标题用 `text-wrap: balance`，正文段落用 `text-wrap: pretty`；不许加在 `*` 上。（typography.md，form-factor-adaptation.md）
4. 装文字的元素（按钮、卡片、标签页等）不写死高度，用 `min-block-size`，让用户放大文字时不被截断；标题不许用省略号截断；不要对句子用 `white-space: nowrap`。（typography.md，form-factor-adaptation.md，accessibility/respect-os-text-scale.md）
5. 不要在 `html`/`:root` 上写死根字号（如 `html { font-size: 16px }`），让浏览器按用户设置来。（respect-os-text-scale.md）
6. 长单词和长网址要能换行，不撑宽页面（`overflow-wrap: anywhere`）；flex 子项里有长字串时加 `min-inline-size: 0`。（form-factor-adaptation.md，css-layout.md）

**11.5 颜色与对比**
1. 文字对比度至少 4.5:1（24px 及以上或 18.66px 粗体的大字至少 3:1），图标至少 3:1。现有色值已核对：#111111 对白 18.9:1，#666666 对白 5.7:1，#0052D9 对白 6.5:1，都达标；以后新增颜色也要先算对比度。（visual-design/color.md）
2. 不许只靠颜色表达状态（如报错只变红）：同时配文字或图标（图标不用表情符号，见第 7 节）。（color.md，html.md §9）
3. Windows 高对比模式下会去掉阴影和背景图：所以边框、分隔线、状态不能只靠阴影或背景图表达（我们第 6 节本来就是"细边框+淡阴影"，保留边框即可）。（color.md）

**11.6 布局与响应式**
1. 不许用 `overflow: hidden` 掩盖布局问题，要从根上修；不要裁掉控件。（css/css-layout.md，form-factor-adaptation.md）
2. 整宽布局不用 `100vw`（会算上滚动条导致横向滚动），用 `100%`；手机上要占满屏高的容器用 `dvh` 而不是 `vh`。（css-layout.md，responsive-design.md）
3. 间距用 `gap`，少用子元素外边距；卡片网格可用 `repeat(auto-fit, minmax(…, 1fr))` 自动换行。（css-layout.md）
4. 固定或吸顶的栏高度不超过屏幕高度的 12%，只放一行，不叠多条吸顶栏；放不下的放进弹出菜单或抽屉。（user-experience/content-first-noise-reduction.md）
5. 吸顶/吸底的栏要避开手机刘海和系统条（用 `env(safe-area-inset-*)` 补内边距）。（form-factor-adaptation.md）

**11.7 打扰与动效**
1. 打开页面时不弹广告、订阅、全屏推广窗；必须的提示（如 Cookie）用小的、不挡内容的横条（远小于屏幕 15%），带"关闭"或"同意"文字按钮。（content-first-noise-reduction.md）
2. 用户阅读时内容不许乱跳：不在当前可见内容上方插入东西，不弹用户没要的浮层。（content-first-noise-reduction.md）
3. 阻断式对话框只用于后果重大的操作（删除、付款、改个人信息），其他用不打断的提示。对话框用原生 `<dialog>` + `showModal()`，要有看得见的关闭按钮。（content-first-noise-reduction.md，html.md §4，accessibility.md §12）
4. 动画只动 `transform` 和 `opacity`；尊重系统"减少动态效果"设置（按需写 `prefers-reduced-motion`），默认以静态为主；任何东西 1 秒内闪烁不许超过 3 次。（motion.md）

**11.8 状态的写法（补充第 9 节）**
1. 加载状态：用 `<progress>`（不知道进度就不写 `value`），不要用不停播报的"加载中…"文字区。（accessibility.md §8，ui-components/progress.md）
2. 报错状态：严重的、需要马上处理的错误（如数据加载失败）用 `role="alert"` 播报；一般提示（如"已保存"、搜索结果数）用 `aria-live="polite"`。（accessibility.md §8）
3. 表单（如果有）：每个输入框都有 `<label for>`，不用占位文字当标签；涉及个人信息的框写对的 `autocomplete`；用户填过并离开后才提示错误（`:user-invalid`），错误文字用 `aria-describedby` 关联；提交失败后把焦点移到第一个出错的框。（accessibility.md §7，forms/，accessibility/accessible-error-announcement.md）

**11.9 代码习惯**
1. 把第 2–5 节的颜色、字号、间距、圆角写成 `:root` 上的 CSS 变量，页面里引用变量，不在行内样式写具体色值和尺寸。（css/css.md §5，html.md §9）
2. 不用行内 `onclick`，用 `addEventListener`。（html.md §9）
3. 非关键脚本加 `defer`（或用 `type="module"`），不放大脚本在 `<head>` 里阻塞；CSS 里不用 `@import`。（performance.md）
4. 从外部 CDN 引的脚本/样式用固定版本号的地址，并加 `integrity`（sha384）和 `crossorigin="anonymous"`。（security/secure-external-subresources.md）

**11.10 验收时怎么查（新增项）**
| 项目 | 设计评审 | QA 实测方法 |
|---|---|---|
| 页面骨架（lang、viewport、title、landmark、单个 h1、标题不跳级） | 查方案说明 | 查页面源码 |
| 图片 alt、宽高、首屏图不懒加载 | 查 | 查源码；看加载时页面是否跳动 |
| 纯键盘操作 | 查交互说明 | 只用键盘走一遍全部可点元素，焦点可见、不卡住 |
| 可点区域 24px / 触屏 44px | 查 | 抽查计算样式尺寸 |
| 不只靠颜色表达状态 | 查 | 截图核对报错态有文字或图标 |
| 开页无弹窗、吸顶栏 ≤12% 屏高 | 查 | 1280 / 390 截图核对 |
| 自动化检查 | — | 跑 Lighthouse 无障碍检查，问题逐条列出（分数满分不等于没问题） |

---

## 第二部分：设计方案（设计总监写）

（待设计总监按简报写入：信息架构与页面清单、逐页线框文字说明、1280px 与 390px 怎么变、逐页验收标准、每处改动的原因。未写入前，本部分视为「未确认」。）

### T005 定时推送知识库
- 完整方案：/workspace/work/IT/T005-design.md（**首页定稿**，Cathy 2026-11-15 20:44 经派确认：方向 A「留白大」，字号用版 2，按规范 v4；核对表见方案第 17 节）。定稿图：/workspace/work/IT/T005-wireframes/A-home-final-1280 / 390 / 320（含 -fold）。版 1 A-home-v2-spec-* 已作废，不再维护；v1 灰框线框留档。
