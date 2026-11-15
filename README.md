# Cathy's Knowledge Base

Cathy 的学习知识库，把各 bot 定时推送按分类和日期归档。线上地址：https://cathysin.github.io/knowledge-base/

个人学习笔记，不构成投资建议。页脚免责声明的对外措辞还需合规审查。当前仓库没有示例文章，真实内容由后续 T012-B 导入 `content/`。

## 本地运行

需要 Node.js 22。

```bash
npm ci
npm run dev       # http://127.0.0.1:4321/knowledge-base/
npm run build     # astro build → 表格处理 → Pagefind → verify-dist
npm run preview   # 预览构建结果，路径同样带 /knowledge-base/
```

## 目录

- `content/<slug>/<YYYY>/<YYYY-MM-DD>-<时点>.md`：文章（front matter 见 `docs/HANDOFF.md`）
- `src/pages/`、`src/components/`、`src/layouts/`、`src/styles/`：页面和样式
- `src/data/categories.ts`、`src/lib/`、`src/content.config.ts`：分类、路径、校验
- `scripts/`：构建后处理和自检；`docs/`：规范、方案、交接说明
- `.github/workflows/deploy.yml`：推到 `main` 后构建并部署 GitHub Pages；构建失败不部署
