// 6 个分类，顺序、名称、slug、来源 bot 按 T005-design.md 第 4.1 节；用途说明按 C-007（Cathy 20:44 定可用）。
export interface Category {
  slug: 'cm-knowledge' | 'market-brief' | 'news-impact' | 'etf-2835' | 'hk-ipo' | 'ai-intel';
  name: string;
  desc: string;
  sourceBot: string;
  /** 1280 下占满整行（1 + 2 + 2 + 1 版式里的第 1、6 块） */
  wide: boolean;
}

export const CATEGORIES: Category[] = [
  { slug: 'cm-knowledge', name: '资本管理知识点', desc: '每个工作日一个资本管理知识点', sourceBot: '每日推送', wide: true },
  { slug: 'market-brief', name: '市场简报', desc: '港股开盘前与盘后的行情简报', sourceBot: '行情分析', wide: false },
  { slug: 'news-impact', name: '新闻板块影响', desc: '全球市场要闻对各板块的影响：事件 → 影响环节 → 板块', sourceBot: '新闻影响', wide: false },
  { slug: 'etf-2835', name: '2835 成分股', desc: '2835 成分股总表、涨跌榜与相关新闻', sourceBot: '2835日报', wide: false },
  { slug: 'hk-ipo', name: '港股新股', desc: '未来 7 天将上市和过去 7 天已上市的港股新股', sourceBot: '港股IPO', wide: false },
  { slug: 'ai-intel', name: 'AI 情报', desc: '每日 AI 情报归档', sourceBot: '每日AI情报', wide: true },
];

export const SLUG_ENUM = CATEGORIES.map((c) => c.slug) as [Category['slug'], ...Category['slug'][]];

export const SLOT_LABEL: Record<string, string> = {
  pre: '开盘前',
  mid: '盘中',
  'mid-1': '盘中第一份',
  'mid-2': '盘中第二份',
  post: '盘后',
  daily: '每日',
};

export const SITE_NAME = "Cathy's Knowledge Base";
export const DISCLAIMER = '仅个人学习笔记，不构成投资建议';
/** 源码仓库地址：pai 2026-11-15 定，本轮把页头页脚链接从 # 改成真实仓库。 */
export const REPO_URL = 'https://github.com/cathysin/knowledge-base';

/** 把连续数字拆出来单独标记，渲染时包成 nowrap，避免「2835」从中间断开。 */
export function splitDigits(text: string): { text: string; isNum: boolean }[] {
  return text.split(/(\d+)/).filter((s) => s.length > 0).map((s) => ({ text: s, isNum: /^\d+$/.test(s) }));
}
