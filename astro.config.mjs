// @ts-check
import { defineConfig } from 'astro/config';

// 纯静态站，部署到 GitHub Pages 项目站 https://cathysin.github.io/knowledge-base/
// 关掉 prefetch，避免预取尚未打开的地址。
// 表格的窄屏处理放在 scripts/enhance-tables.mjs（构建后改 HTML）：
// Astro 7 默认不再走 markdown.rehypePlugins，不加额外 Markdown 套件。
export default defineConfig({
  site: 'https://cathysin.github.io',
  base: '/knowledge-base/',
  output: 'static',
  prefetch: false,
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
  // 正文里的流程块用浅色代码主题，跟全站白底一致（默认是深色，会突兀）
  markdown: {
    shikiConfig: { theme: 'github-light', wrap: true },
  },
});
