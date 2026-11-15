// front matter 校验（T005-design.md 第 6.1 节）。必填项缺失或格式不对时 astro build 直接失败。
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { SLUG_ENUM } from './data/categories';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content' }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    category: z.enum(SLUG_ENUM),
    source_bot: z.string().min(1),
    slot: z.enum(['pre', 'mid', 'mid-1', 'mid-2', 'post', 'daily']),
    push_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    markets: z.array(z.enum(['港股', '美股', '全球'])).optional(),
    tags: z.array(z.string()).max(5).optional(),
    summary: z.string().min(1).max(120),
    as_of: z.coerce.date().optional(),
    sources: z.array(z.string()).optional(),
    // T012-B：导入的推送没经过合规审查，不能写 true；改成可选，导入脚本不写这一项。
    compliance_checked: z.boolean().optional(),
    updated: z.coerce.date().optional(),
    // 方案 6.1 之外加的一项：示例文章标记。真实文章不写或写 false；上线前删掉全部 sample 文章。
    sample: z.boolean().optional(),
  }),
});

export const collections = { posts };
