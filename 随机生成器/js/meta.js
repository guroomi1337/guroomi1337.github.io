// 常量与公共工具
import { getCategoryItems } from './data.js';

export const RARITY_WEIGHT = {
  COMMON: 1,
  UNCOMMON: 0.7,
  RARE: 0.2,
  VERY_RARE: 0.06,
  SECRET: 0.015,
  MYTHIC: 0.003
};

export const RARITY_LABEL = {
  COMMON: '',
  UNCOMMON: '✦',
  RARE: '✦',
  VERY_RARE: '✦✦',
  SECRET: '✦✦',
  MYTHIC: '✦✦✦'
};

export const SERIES = {
  future_letters: { label: '未来来信', file: 'fiction_archive', length: 8, banner: '✉ 一封来自未来的信' },
  archive_files: { label: '████ 机构机密档案', file: 'fiction_archive', length: 6, banner: '■ 机密文件 · 仅供查阅' }
};

export const THEMES = [
  { key: 'animals', label: '动物日', cats: ['animals', 'nature'], desc: '今天的内容更容易遇见动物与自然的怪事。' },
  { key: 'space', label: '宇宙日', cats: ['space', 'nature', 'math'], desc: '今天的内容更容易飞向宇宙与尺度。' },
  { key: 'history', label: '历史日', cats: ['history', 'weird_events', 'lost_things'], desc: '今天的内容更容易来自过去。' },
  { key: 'human', label: '身体日', cats: ['human', 'psychology'], desc: '今天的内容更容易关于你自己。' },
  { key: 'weird', label: '怪事日', cats: ['weird_events', 'unsolved', 'odd_corners'], desc: '今天的内容更容易奇怪。' },
  { key: 'stories', label: '故事日', cats: ['stories', 'fiction_archive', 'brainstorm'], desc: '今天的内容更容易是故事与脑洞。' },
  { key: 'mind', label: '思考日', cats: ['philosophy', 'strange_questions', 'mind_games', 'society'], desc: '今天的内容更容易需要想一会儿。' }
];

export const HIDDEN_QUESTIONS = [
  '如果今晚的梦里出现一个你不认识的人，你希望他/她告诉你什么？',
  '你有没有一件"说出来像吹牛、但确实是真的"的事？',
  '如果明天起床后，世界上所有镜子都照不出你，你最先去哪里确认？',
  '你上一次真心觉得"活着真好"，是因为什么？'
];

export const MYTHIC_TEXT = '你刚刚看到了 99.99% 的人看不到的东西。\n祝你今天发生一件小事，比如抬头时正好有风。';

export const TYPE_LABEL = {
  SCIENCE: '科学',
  FACT: '真实',
  HISTORY: '历史',
  OPINION: '观点',
  THOUGHT_EXPERIMENT: '思想实验',
  COUNTERFACTUAL: '假设',
  FICTION: '虚构',
  LEGEND: '传说',
  HUMOR: '娱乐',
  QUESTION: '问题',
  SYSTEM: '系统',
  CAPSULE: '时间胶囊',
  STORY: '故事',
  CHOICE: '选择',
  TASK: '任务',
  GAME: '游戏'
};

export const PERSONA = {
  animals: '动物语者',
  nature: '自然观察员',
  space: '宇宙过敏体质',
  human: '身体侦探',
  psychology: '大脑偷窥者',
  history: '时光旅人',
  geography: '地图行者',
  tech: '科技考古学家',
  language: '词语猎人',
  math: '数字魔术师',
  weird_events: '怪事收藏家',
  philosophy: '深夜哲学家',
  society: '人间观察员',
  strange_questions: '十万个为什么',
  stories: '故事瘾君子',
  fiction_archive: '档案管理员',
  brainstorm: '离谱但合理',
  quotes: '摘句人',
  mind_games: '脑力运动员',
  choices: '选择困难户',
  counterfactual: '平行世界旅人',
  challenges: '生活实验家',
  unsolved: '谜题守夜人',
  lost_things: '拾荒者',
  odd_corners: '冷门猎手'
};

export function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a));
}

export function weightedPick(list, weights) {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0 || !list.length) return list[Math.floor(Math.random() * list.length)];
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

export function mkSpecial(id, teaser, rarity, presentation, extra = {}) {
  return {
    id,
    category: 'event',
    subcategory: '',
    topic: '',
    factual_type: extra.factual_type || 'SYSTEM',
    presentation,
    rarity,
    difficulty: 1,
    length: 'short',
    tone: 'weird',
    layers: { teaser, why: extra.why || '', deep: extra.deep || '' },
    tags: extra.tags || [],
    source: extra.source || null,
    related: [],
    status: 'published',
    weight: 1,
    sub: extra.sub || ''
  };
}

export async function getSeriesItem(key, index) {
  const cfg = SERIES[key];
  if (!cfg) return null;
  const items = await getCategoryItems(cfg.file);
  return items.find(i => i.series === key && i.series_index === index) || null;
}
