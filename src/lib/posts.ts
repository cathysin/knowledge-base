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
  const time = slot.match(/^([01]\d|2[0-3])([0-5]\d)$/);
  return SLOT_LABEL[slot] ?? (time ? `${time[1]}:${time[2]}` : slot);
}

export function comparePosts(a: Post, b: Post): number {
  return b.data.date.getTime() - a.data.date.getTime()
    || SLOT_ORDER.indexOf(a.data.slot) - SLOT_ORDER.indexOf(b.data.slot)
    || (/^\d{4}$/.test(a.data.slot) && /^\d{4}$/.test(b.data.slot)
      ? b.data.slot.localeCompare(a.data.slot) : 0);
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

/** 课程位置：cm-knowledge 的正文首部有「主题 1/14 货币市场基金 · 利率与流动性基础 · 1.1.1」。 */
export interface Lesson {
  /** 主题序号与总数，如 1 / 14 */
  topicIndex: number;
  topicTotal: number;
  /** 主题名，如「货币市场基金」 */
  topic: string;
  /** 小节名，如「利率与流动性基础」 */
  section: string;
  /** 课程编号，如 1.1.1 */
  serial: string;
}

export function parseLesson(body?: string): Lesson | null {
  if (!body) return null;
  const m = body.match(/课程位置[:：]\s*主题\s*(\d+)\s*\/\s*(\d+)\s*([^·\n]+?)\s*·\s*([^·\n]+?)\s*·\s*(\d+(?:\.\d+)+)/);
  if (!m) return null;
  return {
    topicIndex: Number(m[1]),
    topicTotal: Number(m[2]),
    topic: m[3].trim(),
    section: m[4].trim(),
    serial: m[5],
  };
}

/** 课程编号比较：1.1.2 排在 1.1.10 前面。 */
export function compareSerial(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
