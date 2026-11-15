// 文章路径、排序、空态开关。分类数据和 SLOT_LABEL 仍以 categories.ts 为准。
import { getCollection, type CollectionEntry } from 'astro:content';
import { SLOT_LABEL } from '../data/categories';
import { withBase } from './base';

export const SLOT_ORDER = ['post', 'mid-2', 'mid-1', 'mid', 'pre', 'daily'];

export type Post = CollectionEntry<'posts'>;

/** 自检用：KB_EMPTY=all 或 KB_EMPTY=cm-knowledge,hk-ipo 可触发分类空态。正式构建不设。 */
export function isEmptySlug(slug: string): boolean {
  const emptyEnv = (process.env.KB_EMPTY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return emptyEnv.includes('all') || emptyEnv.includes(slug);
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function yearOf(d: Date): number {
  return d.getUTCFullYear();
}

export function postHref(category: string, date: Date, slot: string): string {
  return withBase(`/${category}/${ymd(date)}-${slot}/`);
}

export function slotLabel(slot: string): string {
  return SLOT_LABEL[slot] ?? slot;
}

export function comparePosts(a: Post, b: Post): number {
  return b.data.date.getTime() - a.data.date.getTime()
    || SLOT_ORDER.indexOf(a.data.slot) - SLOT_ORDER.indexOf(b.data.slot);
}

export async function postsInCategory(slug: string): Promise<Post[]> {
  if (isEmptySlug(slug)) return [];
  const all = await getCollection('posts');
  return all.filter((p) => p.data.category === slug).sort(comparePosts);
}

/** 正文为空则不允许上线（方案 7.3）。 */
export function assertBody(post: Post): void {
  const body = (post.body ?? '').trim();
  if (!body) {
    throw new Error(`文章正文为空，构建失败：${post.id}`);
  }
}
