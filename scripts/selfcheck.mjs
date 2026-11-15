// 前端工匠自检脚本（不是 QA 验收）。用 playwright-core + 本机 Google Chrome 打开本地预览，实测并输出 JSON。
// 用法：先 npm run build && npm run preview（4321），可选空态构建在 4322；然后 node scripts/selfcheck.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4321/';
const EMPTY_BASE = process.env.EMPTY_BASE ?? 'http://127.0.0.1:4322/';
const OUT = '_selfcheck';
mkdirSync(OUT, { recursive: true });
const EXE = process.env.CHROME ?? '/usr/bin/google-chrome';
const VIEWS = [
  { name: '1280', width: 1280, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 568 },
];

// 在页面里跑的测量函数
function measure() {
  const px = (v) => Math.round(parseFloat(v) * 100) / 100;
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).join('.');
    const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return t ? `${s}「${t}」` : s;
  };
  const all = [...document.body.querySelectorAll('*')];
  const res = {};
  res.viewport = innerWidth;
  res.scrollWidth = document.documentElement.scrollWidth;
  res.clientWidth = document.documentElement.clientWidth;
  res.hScroll = res.scrollWidth > res.clientWidth;
  // 越出视口的可见元素
  res.overflowEls = all.filter(vis).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.right > res.clientWidth + 0.5 || r.left < -0.5;
  }).filter((el) => !el.classList.contains('skip-link')).map(label).slice(0, 20);
  // 被裁切的文字容器（scroll 尺寸 > client 尺寸且 overflow 不是 visible）
  res.clipped = all.filter(vis).filter((el) => {
    const cs = getComputedStyle(el);
    if (el.classList.contains('visually-hidden')) return false;
    const ov = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
    return ov && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
  }).map(label);

  // 可点元素
  const clickSel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
  res.clickables = [...document.querySelectorAll(clickSel)].filter(vis).filter((el) => !el.classList.contains('skip-link')).map((el) => {
    const r = el.getBoundingClientRect();
    return { el: label(el), w: px(r.width), h: px(r.height) };
  });

  // 字号
  const DISPLAY_SEL = '.hero h1, .hero .sub, .cat-head h3, .cat-head h3 a, .cat-desc';
  const textEls = all.filter(vis).filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  res.fontSizes = {};
  for (const el of textEls) {
    const fs = px(getComputedStyle(el).fontSize);
    const key = String(fs);
    (res.fontSizes[key] ??= { count: 0, display: 0, examples: [] });
    res.fontSizes[key].count++;
    if (el.matches(DISPLAY_SEL)) res.fontSizes[key].display++;
    if (res.fontSizes[key].examples.length < 4) res.fontSizes[key].examples.push(label(el));
  }
  res.displayEls = [...document.querySelectorAll('.hero h1, .hero .sub, .cat-head h3, .cat-desc')].filter(vis).map((el) => {
    const cs = getComputedStyle(el);
    return { el: label(el), fontSize: px(cs.fontSize), lineHeight: cs.lineHeight, ratio: Math.round(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) * 1000) / 1000 };
  });
  res.nonDisplayFontSizes = [...new Set(textEls.filter((el) => !el.matches(DISPLAY_SEL)).map((el) => px(getComputedStyle(el).fontSize)))].sort((a, b) => a - b);
  res.displayFontSizes = [...new Set(textEls.filter((el) => el.matches(DISPLAY_SEL)).map((el) => px(getComputedStyle(el).fontSize)))].sort((a, b) => a - b);

  // 间距
  const spacing = {};
  const props = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'rowGap', 'columnGap'];
  for (const el of [document.body, ...all]) {
    if (!vis(el) && el !== document.body && !el.classList.contains('visually-hidden') && !el.classList.contains('skip-link')) continue;
    const cs = getComputedStyle(el);
    for (const p of props) {
      const v = cs[p];
      if (v === 'normal' || v === 'auto') continue;
      const n = px(v);
      const k = String(n);
      (spacing[k] ??= []);
      if (spacing[k].length < 6) spacing[k].push(`${label(el)}.${p}`);
    }
  }
  res.spacing = spacing;

  // 颜色
  const colors = {};
  const addC = (c, where) => {
    if (!c || c === 'rgba(0, 0, 0, 0)') return;
    (colors[c] ??= []);
    if (colors[c].length < 6) colors[c].push(where);
  };
  res.gradients = [];
  res.radii = {};
  res.shadows = {};
  res.borders = {};
  for (const el of [document.documentElement, document.body, ...all]) {
    if (!vis(el) && el !== document.body && el !== document.documentElement) continue;
    const cs = getComputedStyle(el);
    addC(cs.color, label(el) + '.color');
    addC(cs.backgroundColor, label(el) + '.background');
    for (const s of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none') {
        addC(cs[`border${s}Color`], label(el) + `.border${s}`);
        const b = `${cs[`border${s}Width`]} ${cs[`border${s}Style`]} ${cs[`border${s}Color`]}`;
        (res.borders[b] ??= 0); res.borders[b]++;
      }
    }
    if (/gradient/i.test(cs.backgroundImage) || /gradient/i.test(cs.borderImageSource)) res.gradients.push(label(el));
    const r = cs.borderTopLeftRadius;
    if (r !== '0px') { (res.radii[r] ??= []); if (res.radii[r].length < 4) res.radii[r].push(label(el)); }
    if (cs.boxShadow !== 'none') { (res.shadows[cs.boxShadow] ??= 0); res.shadows[cs.boxShadow]++; }
  }
  res.colors = colors;
  res.blueUsers = Object.entries(colors).filter(([c]) => c === 'rgb(0, 82, 217)').flatMap(([, w]) => w);

  // 副标题「归档」是否被拆开：取「归」「档」两个字各自的行位置
  const sub = document.querySelector('.hero .sub');
  const walker = document.createTreeWalker(sub, NodeFilter.SHOW_TEXT);
  const charTop = (ch) => {
    walker.currentNode = sub;
    let n;
    while ((n = walker.nextNode())) {
      const i = n.textContent.indexOf(ch);
      if (i >= 0) { const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); return Math.round(rg.getBoundingClientRect().top); }
    }
    return null;
  };
  const lines = [];
  {
    walker.currentNode = sub; let n; const tops = new Map();
    while ((n = walker.nextNode())) {
      for (let i = 0; i < n.textContent.length; i++) {
        const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
        const t = Math.round(rg.getBoundingClientRect().top);
        tops.set(t, (tops.get(t) ?? '') + n.textContent[i]);
      }
    }
    for (const [, s] of [...tops.entries()].sort((a, b) => a[0] - b[0])) lines.push(s);
  }
  res.subtitle = { guiTop: charTop('归'), dangTop: charTop('档'), lines };
  res.subtitle.guidangTogether = res.subtitle.guiTop === res.subtitle.dangTop;

  // 卡片对齐
  const cards = [...document.querySelectorAll('.cat-card')].map((c) => {
    const r = c.getBoundingClientRect();
    const list = c.querySelector('.post-list, .cat-none');
    const lr = list ? list.getBoundingClientRect() : null;
    return { name: c.querySelector('h3').innerText, top: px(r.top + scrollY), bottom: px(r.bottom + scrollY), left: px(r.left), listTop: lr ? px(lr.top + scrollY) : null, listBottom: lr ? px(lr.bottom + scrollY) : null, moreBottom: px(c.querySelector('.more').getBoundingClientRect().bottom + scrollY) };
  });
  const rows = {};
  for (const c of cards) (rows[Math.round(c.top)] ??= []).push(c);
  res.cardRows = Object.values(rows).map((r) => ({
    cards: r.map((c) => c.name),
    bottomDiff: px(Math.max(...r.map((c) => c.bottom)) - Math.min(...r.map((c) => c.bottom))),
    listTopDiff: px(Math.max(...r.map((c) => c.listTop)) - Math.min(...r.map((c) => c.listTop))),
    moreBottomDiff: px(Math.max(...r.map((c) => c.moreBottom)) - Math.min(...r.map((c) => c.moreBottom))),
  }));
  res.cardCount = cards.length;
  res.cardsPerRow = Object.values(rows).map((r) => r.length);

  // 关键距离
  const hdr = document.querySelector('.site-header').getBoundingClientRect();
  const h1 = document.querySelector('.hero h1').getBoundingClientRect();
  const sf = document.querySelector('.search-field').getBoundingClientRect();
  const catsH = document.querySelector('#cats-h').getBoundingClientRect();
  res.dist = {
    headerBottom: px(hdr.bottom), h1Top: px(h1.top), headerToH1: px(h1.top - hdr.bottom),
    searchFieldBottom: px(sf.bottom),
    footerTop: px(document.querySelector('.site-footer').getBoundingClientRect().top + scrollY),
    catsHTop: px(catsH.top + scrollY),
    headerHeight: px(hdr.height),
  };
  res.navCatsDisplay = getComputedStyle(document.querySelector('.nav-cats')).display;
  res.quickDisplay = getComputedStyle(document.querySelector('.quick')).display;

  // 骨架
  res.skeleton = {
    lang: document.documentElement.lang,
    title: document.title,
    mains: document.querySelectorAll('main').length,
    h1s: document.querySelectorAll('h1').length,
    headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => h.tagName + ':' + h.innerText.trim()),
    navs: [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label') || (n.getAttribute('aria-labelledby') && document.getElementById(n.getAttribute('aria-labelledby'))?.innerText)),
    enLang: [...document.querySelectorAll('[lang="en"]')].map(label),
    footerText: document.querySelector('footer').innerText,
    imgs: [...document.images].map((i) => ({ src: i.src, ok: i.complete && i.naturalWidth > 0 })),
    htmlFontSizeInline: document.documentElement.style.fontSize || null,
    outlineNone: [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; } }).filter((t) => /outline\s*:\s*(none|0)/.test(t)),
  };
  return res;
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const report = { base: BASE, chrome: browser.version(), time: new Date().toString(), views: {}, zoom200root: {}, zoom200pref: {}, keyboard: {}, pagefind: {}, empty: {} };

async function openPage(ctx, url) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  const failed = [];
  const badStatus = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) badStatus.push(`${r.status()} ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  return { page, consoleErrors, failed, badStatus };
}

// 1) 三个宽度：截图 + 测量
for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1 });
  const { page, consoleErrors, failed, badStatus } = await openPage(ctx, BASE);
  await page.screenshot({ path: join(OUT, `home-${v.name}.png`), fullPage: true });
  await page.screenshot({ path: join(OUT, `home-${v.name}-fold.png`) });
  const m = await page.evaluate(measure);
  report.views[v.name] = { consoleErrors, failed, badStatus, ...m };

  // 200%（根字号 ×2，和设计总监同一种近似法）
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, `home-${v.name}-root200.png`), fullPage: true });
  const z = await page.evaluate(measure);
  report.zoom200root[v.name] = { scrollWidth: z.scrollWidth, clientWidth: z.clientWidth, hScroll: z.hScroll, overflowEls: z.overflowEls, clipped: z.clipped, subtitle: z.subtitle, displayFontSizes: z.displayFontSizes, nonDisplayFontSizes: z.nonDisplayFontSizes, headerHeight: z.dist.headerHeight, cardRows: z.cardRows };
  await ctx.close();
}

// 2) 200%（浏览器设置：默认字号 16 → 32，跟「设置 > 外观 > 字号」同一个偏好项）
{
  const dir = mkdtempSync(join(tmpdir(), 'kb-zoom-'));
  mkdirSync(join(dir, 'Default'), { recursive: true });
  writeFileSync(join(dir, 'Default', 'Preferences'), JSON.stringify({ webkit: { webprefs: { default_font_size: 32, default_fixed_font_size: 26 } } }));
  for (const v of VIEWS) {
    const ctx = await chromium.launchPersistentContext(dir, { executablePath: EXE, args: ['--no-sandbox'], viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1 });
    const { page, consoleErrors } = await openPage(ctx, BASE);
    const rootFs = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    await page.screenshot({ path: join(OUT, `home-${v.name}-pref200.png`), fullPage: true });
    const z = await page.evaluate(measure);
    report.zoom200pref[v.name] = { rootFontSize: rootFs, consoleErrors, scrollWidth: z.scrollWidth, clientWidth: z.clientWidth, hScroll: z.hScroll, overflowEls: z.overflowEls, clipped: z.clipped, subtitle: z.subtitle, quickDisplay: z.quickDisplay, cardsPerRow: z.cardsPerRow, displayFontSizes: z.displayFontSizes, nonDisplayFontSizes: z.nonDisplayFontSizes };
    await ctx.close();
  }
}

// 3) 键盘：Tab 走一遍（1280 和 390）
for (const v of [VIEWS[0], VIEWS[1]]) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height } });
  const { page } = await openPage(ctx, BASE);
  const seq = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), text: (el.innerText || el.getAttribute('aria-label') || el.id || '').trim().replace(/\s+/g, ' ').slice(0, 20), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, focusVisible: el.matches(':focus-visible'), w: Math.round(r.width), h: Math.round(r.height), inView: r.bottom > 0 && r.top < innerHeight };
    });
    if (!info) { seq.push({ wrap: true }); break; }
    seq.push(info);
  }
  if (v.name === '1280') {
    // 第一个 Tab 是跳到正文，截图看它出现
    await page.goto(BASE); await page.keyboard.press('Tab');
    await page.screenshot({ path: join(OUT, 'home-1280-skiplink-focus.png') });
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    await page.screenshot({ path: join(OUT, 'home-1280-focus-input.png') });
  }
  report.keyboard[v.name] = seq;
  await ctx.close();
}

// 4) Pagefind 索引能否在浏览器里查到（首页不加载脚本，这里由测试代码手动 import）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const { page, consoleErrors } = await openPage(ctx, BASE);
  report.pagefind = await page.evaluate(async () => {
    try {
      const raw = document.documentElement.dataset.base || '/';
      const base = raw.endsWith('/') ? raw : raw + '/';
      const pf = await import(base + 'pagefind/pagefind.js');
      await pf.init();
      const out = {};
      for (const q of ['资产配置', '示例', '港股', '不存在的词汇乱码']) {
        const r = await pf.search(q);
        const first = r.results[0] ? await r.results[0].data() : null;
        out[q] = { count: r.results.length, firstUrl: first?.url ?? null, excerpt: first?.excerpt?.slice(0, 80) ?? null };
      }
      return { ok: true, out };
    } catch (e) { return { ok: false, error: String(e) }; }
  });
  report.pagefind.consoleErrors = consoleErrors;
  // 提交搜索表单的去向（结果页下一张卡做）
  await page.fill('#q', '示例');
  const [nav] = await Promise.all([page.waitForNavigation().catch(() => null), page.click('button[type=submit]')]);
  report.pagefind.submitUrl = page.url();
  report.pagefind.submitStatus = nav ? nav.status() : null;
  await ctx.close();
}

// 5) 空态（KB_EMPTY=all 构建，4322）
try {
  for (const v of [VIEWS[0], VIEWS[1]]) {
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height } });
    const { page, consoleErrors } = await openPage(ctx, EMPTY_BASE);
    await page.screenshot({ path: join(OUT, `home-${v.name}-empty.png`), fullPage: true });
    report.empty[v.name] = await page.evaluate(() => ({
      allEmptyMsg: document.querySelector('.cats-empty')?.innerText ?? null,
      cardEmptyMsgs: [...document.querySelectorAll('.cat-none')].map((e) => e.innerText),
      moreLinks: document.querySelectorAll('.more').length,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    report.empty[v.name].consoleErrors = consoleErrors;
    await ctx.close();
  }
} catch (e) { report.empty.error = String(e); }

await browser.close();
writeFileSync(join(OUT, 'selfcheck.json'), JSON.stringify(report, null, 2));
console.log('selfcheck 完成，结果写入 _selfcheck/selfcheck.json');
