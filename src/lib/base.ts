/** 把站内路径接到 Astro `base` 上。GitHub Pages 项目站的 base 是 `/knowledge-base/`。 */
export function baseUrl(): string {
  const raw = import.meta.env.BASE_URL || '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** 站内路径（`/`、`/search/`、`/#cats`）或外链原样返回。 */
export function withBase(path = '/'): string {
  const b = baseUrl();
  if (!path || path === '/') return b;
  if (/^(https?:|mailto:)/i.test(path)) return path;
  if (path.startsWith('#') || path.startsWith('/#')) {
    const hash = path.startsWith('/#') ? path.slice(1) : path;
    return `${b}${hash}`;
  }
  const p = path.startsWith('/') ? path.slice(1) : path;
  return b + p;
}
