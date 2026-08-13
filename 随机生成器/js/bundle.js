// 下一件 · 自动打包生成，请勿手改此文件（源码在 js/*.js，改完跑 node tools/build-bundle.js）

/* ========== data.js ========== */
// 数据加载：优先读取 data/*.json；file:// 直开时回退到内嵌数据（js/embedded-data.js）
let manifest = null;
let embedded = null;
let mode = 'remote';
const cache = {};

async function initData() {
  try {
    const res = await fetch('data/index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest not found');
    manifest = await res.json();
    mode = 'remote';
  } catch (e) {
    await loadEmbeddedFallback();
    if (window.__EMBEDDED_DATA__) {
      manifest = window.__EMBEDDED_DATA__.manifest;
      embedded = window.__EMBEDDED_DATA__.categories;
      mode = 'embedded';
    } else {
      throw new Error('无法加载内容清单（data/index.json 不存在）');
    }
  }
}

// 在线加载失败（比如直接双击 index.html）时，动态加载内嵌数据包
function loadEmbeddedFallback() {
  return new Promise(resolve => {
    if (window.__EMBEDDED_DATA__ || typeof document === 'undefined') {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'js/embedded-data.js';
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

function getManifest() {
  return manifest;
}

function isEmbedded() {
  return mode === 'embedded';
}

async function getCategoryItems(key) {
  if (cache[key]) return cache[key];
  if (mode === 'embedded') {
    cache[key] = embedded[key] || [];
    return cache[key];
  }
  const cat = manifest.categories.find(c => c.key === key);
  if (!cat) return [];
  const items = await fetch(cat.file).then(r => r.json());
  cache[key] = items;
  return items;
}

async function findItemById(id) {
  const map = manifest.idToCat || {};
  const key = map[id];
  if (!key) return null;
  const items = await getCategoryItems(key);
  return items.find(i => i.id === id) || null;
}

async function preloadCategories(keys) {
  await Promise.all(keys.map(key => getCategoryItems(key).catch(() => null)));
}


/* ========== state.js ========== */
// 本地状态：全部存在浏览器 localStorage 里，不联网、不登录
const KEY = 'nextthing.state.v1';

const DEFAULT_STATE = {
  recentIds: [],
  todayIds: [],
  todayDate: '',
  categoryRecent: [],
  moodSeq: [],
  presSeq: [],
  lenSeq: [],
  favCat: {},
  disCat: {},
  favorites: [],
  history: [],
  stats: {
    clicks: 0,
    rareSeen: 0,
    deepCount: 0,
    disliked: 0,
    capsulesSent: 0,
    seriesCompleted: [],
    categoriesExplored: {}
  },
  lastActive: '',
  streak: 0,
  achievements: [],
  desire: 0,
  clicksSinceFav: 0,
  series: {},
  seriesQueue: null,
  notes: [],
  chain: null,
  theme: 'archive',
  lastProfile: null
};

let state = load();

function getState() {
  return state;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // 存储不可用时静默（比如隐私模式）
  }
}

function resetAll() {
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  save();
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function refreshDay() {
  const t = todayStr();
  if (state.todayDate !== t) {
    state.todayDate = t;
    state.todayIds = [];
    save();
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
    const parsed = JSON.parse(raw);
    return {
      ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
      ...parsed,
      stats: { ...DEFAULT_STATE.stats, ...(parsed.stats || {}) }
    };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}


/* ========== meta.js ========== */
// 常量与公共工具


const RARITY_WEIGHT = {
  COMMON: 1,
  UNCOMMON: 0.7,
  RARE: 0.2,
  VERY_RARE: 0.06,
  SECRET: 0.015,
  MYTHIC: 0.003
};

const RARITY_LABEL = {
  COMMON: '',
  UNCOMMON: '✦',
  RARE: '✦',
  VERY_RARE: '✦✦',
  SECRET: '✦✦',
  MYTHIC: '✦✦✦'
};

const SERIES = {
  future_letters: { label: '未来来信', file: 'fiction_archive', length: 8, banner: '✉ 一封来自未来的信' },
  archive_files: { label: '████ 机构机密档案', file: 'fiction_archive', length: 6, banner: '■ 机密文件 · 仅供查阅' }
};

const THEMES = [
  { key: 'animals', label: '动物日', cats: ['animals', 'nature'], desc: '今天的内容更容易遇见动物与自然的怪事。' },
  { key: 'space', label: '宇宙日', cats: ['space', 'nature', 'math'], desc: '今天的内容更容易飞向宇宙与尺度。' },
  { key: 'history', label: '历史日', cats: ['history', 'weird_events', 'lost_things'], desc: '今天的内容更容易来自过去。' },
  { key: 'human', label: '身体日', cats: ['human', 'psychology'], desc: '今天的内容更容易关于你自己。' },
  { key: 'weird', label: '怪事日', cats: ['weird_events', 'unsolved', 'odd_corners'], desc: '今天的内容更容易奇怪。' },
  { key: 'stories', label: '故事日', cats: ['stories', 'fiction_archive', 'brainstorm'], desc: '今天的内容更容易是故事与脑洞。' },
  { key: 'mind', label: '思考日', cats: ['philosophy', 'strange_questions', 'mind_games', 'society'], desc: '今天的内容更容易需要想一会儿。' }
];

const HIDDEN_QUESTIONS = [
  '如果今晚的梦里出现一个你不认识的人，你希望他/她告诉你什么？',
  '你有没有一件"说出来像吹牛、但确实是真的"的事？',
  '如果明天起床后，世界上所有镜子都照不出你，你最先去哪里确认？',
  '你上一次真心觉得"活着真好"，是因为什么？'
];

const MYTHIC_TEXT = '你刚刚看到了 99.99% 的人看不到的东西。\n祝你今天发生一件小事，比如抬头时正好有风。';

const TYPE_LABEL = {
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

const PERSONA = {
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

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a));
}

function weightedPick(list, weights) {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0 || !list.length) return list[Math.floor(Math.random() * list.length)];
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

function mkSpecial(id, teaser, rarity, presentation, extra = {}) {
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

async function getSeriesItem(key, index) {
  const cfg = SERIES[key];
  if (!cfg) return null;
  const items = await getCategoryItems(cfg.file);
  return items.find(i => i.series === key && i.series_index === index) || null;
}


/* ========== rare.js ========== */
// 稀有事件系统：极低概率，但绝不跳吓



async function rollEvent(state) {
  const hard = Math.random() < 0.0001;
  const chance = hard ? 1 : Math.min(0.08, state.desire * 0.0012);
  if (Math.random() >= chance) return null;

  const seriesAvailable = Object.keys(SERIES).filter(k => !(state.series[k] > 0));
  const options = [
    { id: 'style', w: 30 },
    { id: 'hidden', w: 24 },
    { id: 'fourth', w: 22 },
    { id: 'series', w: seriesAvailable.length ? 16 : 0 },
    { id: 'mythic', w: hard ? 10 : 0.2 }
  ];
  const picked = weightedPick(options, options.map(o => o.w));

  if (picked.id === 'style') {
    return {
      kind: 'style',
      item: mkSpecial('EVT-STYLE', '档案馆的灯闪了一下，系统短暂进入了维护模式。一切正常，请继续。', 'VERY_RARE', 'SYSTEM', { sub: '系统提示' })
    };
  }

  if (picked.id === 'hidden') {
    const q = HIDDEN_QUESTIONS[randInt(0, HIDDEN_QUESTIONS.length)];
    return {
      kind: 'item',
      item: mkSpecial('EVT-HIDDEN-' + randInt(1000, 9999), q, 'VERY_RARE', 'QUESTION', { factual_type: 'QUESTION', sub: '隐藏问题' }),
      via: 'event'
    };
  }

  if (picked.id === 'fourth') {
    const clicks = state.stats.clicks + 1;
    const favCount = state.favorites.length;
    const line = favCount === 0
      ? '这是你第 ' + clicks + ' 次点击。你还没收藏过任何东西——是不是都不够好？'
      : '这是你第 ' + clicks + ' 次点击。你收藏过 ' + favCount + ' 件东西，而我全都记得。';
    return {
      kind: 'item',
      item: mkSpecial('EVT-4TH', line, 'SECRET', 'SYSTEM', { sub: '系统低语' }),
      via: 'event'
    };
  }

  if (picked.id === 'series') {
    const key = seriesAvailable[randInt(0, seriesAvailable.length)];
    const item = await getSeriesItem(key, 1);
    if (item) {
      state.series[key] = 1;
      state.seriesQueue = { series: key, nextIndex: 2, clicksUntil: randInt(1, 5) };
      return {
        kind: 'item',
        item,
        via: 'series',
        banner: SERIES[key].banner + ' · 1 / ' + SERIES[key].length
      };
    }
  }

  return {
    kind: 'item',
    item: mkSpecial('EVT-MYTHIC', MYTHIC_TEXT, 'MYTHIC', 'SYSTEM', { sub: '唯一时刻' }),
    via: 'event'
  };
}


/* ========== scheduler.js ========== */
// 随机调度器：有记忆的随机





let eventQueue = [];

function emit(e) {
  eventQueue.push(e);
}

function drainEvents() {
  const e = eventQueue;
  eventQueue = [];
  return e;
}

function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

function getTodayTheme() {
  return THEMES[dayOfYear() % THEMES.length];
}

async function pickNext() {
  refreshDay();
  const state = getState();

  // 1. 时间胶囊到期
  const due = state.notes.find(n => n.due <= todayStr());
  if (due) {
    state.notes = state.notes.filter(n => n !== due);
    const item = {
      id: 'CAP-' + Date.now(),
      category: 'event',
      factual_type: 'CAPSULE',
      presentation: 'LETTER',
      rarity: 'UNCOMMON',
      difficulty: 1,
      length: 'short',
      tone: 'warm',
      layers: { teaser: due.text, why: '', deep: '' },
      tags: [],
      source: null,
      related: [],
      status: 'published',
      weight: 1,
      sub: '来自 ' + due.created + ' 的你'
    };
    record(item, 'capsule');
    save();
    return { kind: 'item', item, via: 'capsule' };
  }

  // 2. 系列注入
  if (state.seriesQueue) {
    const q = state.seriesQueue;
    q.clicksUntil -= 1;
    if (q.clicksUntil <= 0) {
      const item = await getSeriesItem(q.series, q.nextIndex);
      if (item) {
        q.nextIndex += 1;
        q.clicksUntil = randInt(1, 5);
        const total = SERIES[q.series].length;
        if (q.nextIndex > total) {
          state.seriesQueue = null;
          state.stats.seriesCompleted.push(q.series);
          emit({ type: 'toast', text: '系列完成：' + SERIES[q.series].label });
        }
        record(item, 'series');
        save();
        return {
          kind: 'item',
          item,
          via: 'series',
          banner: SERIES[q.series].banner + ' · ' + item.series_index + ' / ' + total
        };
      }
    }
  }

  // 3. 稀有事件
  const ev = await rollEvent(state);
  if (ev) {
    state.desire = 0;
    save();
    return ev;
  }

  // 4. 温柔关联（8%）：上一件与这一件有隐秘关系
  const last = state.history.find(h => h.kind === 'item');
  if (!state.chain && last && Math.random() < 0.08) {
    const lastItem = await findItemById(last.id);
    if (lastItem && lastItem.related && lastItem.related.length) {
      const rel = await resolveRelated(lastItem, state.recentIds.slice(-40));
      if (rel) {
        record(rel, 'gentle');
        save();
        return { kind: 'item', item: rel, via: 'gentle', coincidence: true };
      }
    }
  }

  // 5. 组合卡（5%）：把本次会话的两件内容串成一个新问题
  if (Math.random() < 0.05 && state.history.length >= 2) {
    const items = state.history.filter(h => h.kind === 'item' && h.teaser);
    const a = items[0];
    const b = items.find(h => h.id !== a.id);
    if (a && b) {
      const mash = {
        id: 'MSH-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        category: 'event',
        factual_type: 'HUMOR',
        presentation: 'QUESTION',
        rarity: 'UNCOMMON',
        difficulty: 1,
        length: 'short',
        tone: 'whimsical',
        layers: {
          teaser: '你刚看到「' + a.teaser + '」，又看到「' + b.teaser + '」。如果它们相遇，会发生什么？',
          why: '',
          deep: ''
        },
        tags: [],
        source: null,
        related: [],
        status: 'published',
        weight: 1,
        sub: '✦ 组合'
      };
      record(mash, 'mashup');
      save();
      return { kind: 'item', item: mash, via: 'mashup', mashup: true };
    }
  }

  // 6. 正常抽取（含探索链逻辑）
  const chosen = await pickNormal(last);
  record(chosen.item, chosen.via === 'chain' ? 'chain' : 'random');
  save();
  return { kind: 'item', item: chosen.item, via: chosen.via, chain: state.chain };
}

async function pickNormal(last) {
  const state = getState();

  // 探索链：60% 走"相关内容"，最多 5 层
  if (state.chain && last) {
    const lastItem = await findItemById(last.id);
    if (lastItem && lastItem.related && lastItem.related.length && state.chain.depth < 5 && Math.random() < 0.6) {
      const rel = await resolveRelated(lastItem, state.recentIds.slice(-20));
      if (rel) {
        state.chain.depth += 1;
        return { item: rel, via: 'chain' };
      }
    }
    state.chain = null;
  }

  const cat = pickCategory();
  const item = await pickItemFromCategory(cat);
  if (!item) return { item: await fallbackItem(), via: 'random' };
  return { item, via: 'random' };
}

function pickCategory() {
  const manifest = getManifest();
  const state = getState();
  const recent = state.categoryRecent;
  const seenIds = new Set([...state.recentIds, ...state.todayIds]);
  const unseenOf = key => {
    const cat = manifest.categories.find(c => c.key === key);
    const total = (cat && cat.count) || 1;
    let seenShare = 0;
    for (const id of seenIds) {
      if (manifest.idToCat[id] === key) seenShare++;
    }
    return Math.max(0, total - seenShare);
  };
  const eligible = manifest.categories.filter(c => {
    const last6 = recent.slice(-6);
    const cooldownOk = last6.filter(k => k === c.key).length < 3;
    // 库存见底的类别暂停抽选，等它的内容滑出"最近不重复"窗口再回来
    const hasSupply = unseenOf(c.key) >= 3 || (c.count || 1) <= 3;
    return cooldownOk && hasSupply;
  });
  const pool = eligible.length ? eligible : manifest.categories;
  const weights = pool.map(c => {
    let w = c.weight || 5;
    // 库存系数：类别里"没看过"的占比越低，权重越低，避免小类别反复出旧货
    const total = c.count || 1;
    const unseen = unseenOf(c.key);
    w *= Math.max(0.12, unseen / total);
    const pos = recent.lastIndexOf(c.key);
    if (pos !== -1) {
      const dist = recent.length - 1 - pos;
      if (dist === 0) w *= 0.35;
      else if (dist === 1) w *= 0.6;
      else if (dist === 2) w *= 0.85;
    }
    const f = state.favCat[c.key] || 0;
    const d = state.disCat[c.key] || 0;
    w *= Math.min(1.5, 1 + f * 0.15) * Math.max(0.3, 1 - d * 0.2);
    return Math.max(0.05, w);
  });
  return weightedPick(pool, weights);
}

async function pickItemFromCategory(cat) {
  const state = getState();
  // 系列内容只通过"系列系统"出现，不进入普通随机池，避免重复曝光
  const items = (await getCategoryItems(cat.key)).filter(i => i.status === 'published' && !i.series);
  if (!items.length) return null;
  let pool = items.filter(i => !state.recentIds.includes(i.id) && !state.todayIds.includes(i.id));
  if (!pool.length) {
    // 全部看过：优先选"最久没见到"的
    const sorted = [...items].sort((a, b) => {
      const ia = state.recentIds.lastIndexOf(a.id);
      const ib = state.recentIds.lastIndexOf(b.id);
      return (ia === -1 ? -1 : ia) - (ib === -1 ? -1 : ib);
    });
    const notToday = sorted.filter(i => !state.todayIds.includes(i.id));
    pool = notToday.length ? notToday : sorted;
  }

  const last = state.history.find(h => h.kind === 'item');
  const scores = pool.map(item => scoreItem(item, last));
  const chosen = weightedPick(pool, scores);
  return chosen || pool[randInt(0, pool.length)];
}

function scoreItem(item, last) {
  const state = getState();
  let s = (RARITY_WEIGHT[item.rarity] || 1) * (item.weight || 1);

  const mood = state.moodSeq;
  if (mood.length && mood[mood.length - 1] === item.tone) s *= 0.55;
  if (mood.slice(-3).filter(t => t === item.tone).length >= 2) s *= 0.3;

  const pres = state.presSeq;
  if (pres.length && pres[pres.length - 1] === item.presentation) s *= 0.5;
  if (pres.slice(-3).filter(p => p === item.presentation).length >= 2) s *= 0.25;

  const len = state.lenSeq;
  if (item.length === 'long' && len.slice(-2).every(l => l === 'long')) s *= 0.2;

  if (last && last.tags && item.tags) {
    const overlap = item.tags.filter(t => last.tags.includes(t)).length;
    const minSize = Math.min(item.tags.length, last.tags.length);
    if (minSize && overlap / minSize > 0.5) s *= 0.25;
    else if (minSize && overlap / minSize > 0.25) s *= 0.6;
  }

  const theme = getTodayTheme();
  if (theme.cats.includes(item.category)) s *= 1.4;

  return s;
}

async function resolveRelated(item, excludeIds = []) {
  const rels = (item.related || []).slice(0, 3);
  for (const r of rels) {
    const it = await findItemById(r.id);
    if (it && !excludeIds.includes(it.id)) return it;
  }
  return null;
}

async function fallbackItem() {
  const manifest = getManifest();
  for (const c of manifest.categories) {
    const items = (await getCategoryItems(c.key)).filter(i => i.status === 'published');
    if (items.length) return items[randInt(0, items.length)];
  }
  return {
    id: 'EMPTY',
    category: 'event',
    factual_type: 'SYSTEM',
    presentation: 'SYSTEM',
    rarity: 'COMMON',
    layers: { teaser: '内容库暂时是空的，去 data/ 里加几条吧。', why: '', deep: '' },
    tags: [],
    status: 'published'
  };
}

function recentCap() {
  const manifest = getManifest();
  const total = manifest.total || 100;
  return Math.max(80, Math.min(300, Math.floor(total * 0.5)));
}

function record(item, via) {
  const state = getState();
  state.stats.clicks += 1;
  state.desire += 2;
  state.clicksSinceFav += 1;
  if (state.clicksSinceFav >= 5) {
    state.desire += 2;
    state.clicksSinceFav = 0;
  }

  if (item && item.id) {
    state.recentIds.push(item.id);
    const cap = recentCap();
    if (state.recentIds.length > cap) state.recentIds.splice(0, state.recentIds.length - cap);
    if (!state.todayIds.includes(item.id)) state.todayIds.push(item.id);

    if (item.category && item.category !== 'event') {
      state.categoryRecent.push(item.category);
      if (state.categoryRecent.length > 8) state.categoryRecent.shift();
      state.stats.categoriesExplored[item.category] = (state.stats.categoriesExplored[item.category] || 0) + 1;
    }
    if (item.tone) {
      state.moodSeq.push(item.tone);
      if (state.moodSeq.length > 6) state.moodSeq.shift();
    }
    if (item.presentation) {
      state.presSeq.push(item.presentation);
      if (state.presSeq.length > 6) state.presSeq.shift();
    }
    if (item.length) {
      state.lenSeq.push(item.length);
      if (state.lenSeq.length > 6) state.lenSeq.shift();
    }

    const kind = via === 'mashup' ? 'mashup'
      : (via === 'series' || via === 'chain' || via === 'gentle') ? 'callback'
      : (item.category === 'event' ? 'event' : 'item');
    state.history.unshift({
      id: item.id,
      category: item.category,
      teaser: (item.layers && item.layers.teaser) || '',
      tags: item.tags || [],
      kind,
      ts: Date.now()
    });
    if (state.history.length > 3000) state.history.length = 3000;

    if (['RARE', 'VERY_RARE', 'SECRET', 'MYTHIC'].includes(item.rarity)) {
      state.stats.rareSeen += 1;
      emit({ type: 'rare', rarity: item.rarity });
    }
  }

  const t = todayStr();
  if (state.lastActive !== t) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
    state.streak = state.lastActive === yStr ? state.streak + 1 : 1;
    state.lastActive = t;
  }

  checkAchievements();
  if (state.stats.clicks > 0 && state.stats.clicks % 30 === 0) {
    state.lastProfile = buildProfile();
    emit({ type: 'profile', profile: state.lastProfile });
  }
  save();
}

function startChain() {
  const state = getState();
  state.chain = { depth: 1 };
  save();
}

function exitChain() {
  const state = getState();
  state.chain = null;
  save();
}

function markDeep() {
  const state = getState();
  state.stats.deepCount += 1;
  checkAchievements();
  save();
}

function addFavorite(item) {
  const state = getState();
  const idx = state.favorites.findIndex(f => f.id === item.id);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    state.favCat[item.category] = Math.max(0, (state.favCat[item.category] || 1) - 1);
    save();
    return false;
  }
  state.favorites.unshift({ id: item.id, category: item.category, teaser: item.layers.teaser, ts: Date.now() });
  state.favCat[item.category] = (state.favCat[item.category] || 0) + 1;
  checkAchievements();
  save();
  return true;
}

function markDislike(item) {
  const state = getState();
  state.disCat[item.category] = (state.disCat[item.category] || 0) + 1;
  state.stats.disliked += 1;
  save();
}

function addCapsuleNote(text, days) {
  const state = getState();
  const t = todayStr();
  const due = new Date();
  due.setDate(due.getDate() + days);
  const dueStr = due.getFullYear() + '-' + String(due.getMonth() + 1).padStart(2, '0') + '-' + String(due.getDate()).padStart(2, '0');
  state.notes.push({ text, due: dueStr, created: t });
  state.stats.capsulesSent += 1;
  checkAchievements();
  save();
}

function checkAchievements() {
  const state = getState();
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements.includes(a.id) && a.check(state)) {
      state.achievements.push(a.id);
      emit({ type: 'achievement', id: a.id });
      changed = true;
    }
  }
  if (changed) save();
}

function buildProfile() {
  const state = getState();
  const manifest = getManifest();
  const map = {};
  manifest.categories.forEach(c => { map[c.key] = c.label; });

  const explored = Object.entries(state.stats.categoriesExplored).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => map[k] || k);
  const favs = Object.entries(state.favCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => map[k] || k);

  const topKey = Object.entries(state.stats.categoriesExplored).sort((a, b) => b[1] - a[1])[0];
  const persona = topKey && PERSONA[topKey[0]] ? PERSONA[topKey[0]] : '好奇的漫游者';
  const title = '你的探索人格：' + persona;
  const lines = [];
  if (explored.length) lines.push('你偏爱：' + explored.join('、'));
  if (favs.length) lines.push('你的收藏里藏着：' + favs.join('、'));
  lines.push('共点击 ' + state.stats.clicks + ' 次，见过 ' + state.stats.rareSeen + ' 件罕见内容。');
  return { title, lines };
}

const ACHIEVEMENTS = [
  { id: 'first_click', icon: '✦', name: '第一次遇见', desc: '按下第一次"随机一下"', check: s => s.stats.clicks >= 1 },
  { id: 'ten_clicks', icon: '☕', name: '十件见闻', desc: '累计点击 10 次', check: s => s.stats.clicks >= 10 },
  { id: 'hundred_clicks', icon: '🌌', name: '百件见闻', desc: '累计点击 100 次', check: s => s.stats.clicks >= 100 },
  { id: 'first_fav', icon: '♥', name: '一见钟情', desc: '收藏第一件内容', check: s => s.favorites.length >= 1 },
  { id: 'ten_fav', icon: '💎', name: '私人藏品', desc: '收藏 10 件内容', check: s => s.favorites.length >= 10 },
  { id: 'explorer', icon: '🗺', name: '十方世界', desc: '探索过 10 个不同类别', check: s => Object.keys(s.stats.categoriesExplored).length >= 10 },
  { id: 'rare_hunter', icon: '✨', name: '稀有目击', desc: '遇到 1 件罕见内容', check: s => s.stats.rareSeen >= 1 },
  { id: 'rare_x3', icon: '🌠', name: '幸运星', desc: '遇到 3 件罕见内容', check: s => s.stats.rareSeen >= 3 },
  { id: 'streak_3', icon: '🔥', name: '三日之约', desc: '连续 3 天都按过', check: s => s.streak >= 3 },
  { id: 'streak_7', icon: '🌟', name: '一周一见', desc: '连续 7 天都按过', check: s => s.streak >= 7 },
  { id: 'series_any', icon: '✉', name: '收信人', desc: '完成一个系列', check: s => s.stats.seriesCompleted.length >= 1 },
  { id: 'capsule_sent', icon: '⏳', name: '寄给未来', desc: '给未来的自己留了一句话', check: s => s.stats.capsulesSent >= 1 },
  { id: 'deep_diver', icon: '🕳', name: '深潜者', desc: '深入了解 20 次', check: s => s.stats.deepCount >= 20 }
];




/* ========== ui.js ========== */
// 界面渲染与交互





let catLabels = {};

function initUI() {
  const manifest = getManifest();
  manifest.categories.forEach(c => { catLabels[c.key] = c.label; });
  applyTheme(getState().theme);
  wireButtons();
  renderDrawerAll();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function wireButtons() {
  document.getElementById('btnGo').addEventListener('click', doPick);
  document.getElementById('btnTheme').addEventListener('click', toggleTheme);
  document.getElementById('btnArchive').addEventListener('click', openDrawer);
  document.getElementById('btnToday').addEventListener('click', () => {
    openDrawer();
    switchTab('today');
  });
  document.getElementById('btnCloseDrawer').addEventListener('click', closeDrawer);
  document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);
  document.getElementById('btnCapsule').addEventListener('click', openCapsuleModal);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.addEventListener('keydown', e => {
    const drawer = document.getElementById('drawer');
    const modal = document.getElementById('modal');
    if (e.key === 'Escape') {
      if (!modal.classList.contains('hidden')) closeModal();
      else if (drawer.classList.contains('open')) closeDrawer();
    }
    const tag = e.target && e.target.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((e.key === ' ' || e.key === 'ArrowRight') && !drawer.classList.contains('open') && modal.classList.contains('hidden')) {
      e.preventDefault();
      doPick();
    }
  });
}

// ---------- 主流程 ----------

async function doPick() {
  const btn = document.getElementById('btnGo');
  if (btn && !btn.disabled) {
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 180);
  }
  const display = await pickNext();
  renderCard(display);
  handleEvents();
}

async function showDeepLink(id) {
  const item = await findItemById(id);
  if (!item) {
    showIntro();
    return;
  }
  recordExternal(item);
  renderCard({ kind: 'item', item, via: 'link' });
  handleEvents();
}

function recordExternal(item) {
  // 直接展示深链内容：计入统计
  record(item, 'link');
}

function renderCard(display) {
  const card = document.getElementById('card');
  const intro = document.getElementById('intro');
  intro.classList.add('hidden');
  card.classList.remove('hidden');
  card.innerHTML = '';

  const body = document.body;
  body.classList.remove('terminal');

  const state = getState();
  const item = display.item || {};

  if (display.via === 'style') {
    body.classList.add('terminal');
  }

  const isRare = ['RARE', 'VERY_RARE', 'SECRET', 'MYTHIC'].includes(item.rarity);
  card.classList.toggle('rare', isRare);
  card.classList.toggle('mashup', !!display.mashup);

  // 元信息行
  const meta = el('div', 'card-meta');
  const chips = el('div', 'card-chips');
  const typeLabel = TYPE_LABEL[item.factual_type] || '未知';
  chips.appendChild(el('span', 'chip type', typeLabel));
  const catLabel = catLabels[item.category] || (item.sub || '');
  if (catLabel && item.category !== 'event') chips.appendChild(el('span', 'chip', catLabel));
  if (item.series && SERIES[item.series]) chips.appendChild(el('span', 'chip', SERIES[item.series].label));
  if (item.sub) chips.appendChild(el('span', 'chip', item.sub));
  meta.appendChild(chips);

  const rarityText = RARITY_LABEL[item.rarity] || '';
  if (rarityText) {
    const rm = el('span', 'rarity-mark', rarityText);
    rm.title = item.rarity === 'MYTHIC' ? '极罕见' : item.rarity === 'SECRET' ? '隐藏内容' : '罕见内容';
    meta.appendChild(rm);
  }
  card.appendChild(meta);

  // 系列横幅
  if (display.banner) {
    card.appendChild(el('div', 'coincidence-note', display.banner));
  }

  // 探索链横幅
  if (state.chain) {
    const chainBar = el('div', 'chain-bar');
    const info = el('span', '', '探索链 · 第 ' + state.chain.depth + ' 层');
    const exitBtn = el('button', 'chain-exit', '退出 → 随机');
    exitBtn.addEventListener('click', () => { exitChain(); doPick(); });
    chainBar.appendChild(info);
    chainBar.appendChild(exitBtn);
    card.appendChild(chainBar);
  }

  // 主体
  const teaser = item.layers && item.layers.teaser ? item.layers.teaser : '';
  card.appendChild(el('div', 'teaser', teaser));

  if (display.coincidence) {
    card.appendChild(el('div', 'coincidence-note', '✦ 你们不是偶然相遇'));
  }

  const why = item.layers && item.layers.why ? item.layers.why : '';
  const deep = item.layers && item.layers.deep ? item.layers.deep : '';
  appendExpandable(card, '展开一点', why, 1);
  appendExpandable(card, '再深入一点', deep, 2);

  // 底部信息
  const extra = el('div', 'card-extra');
  if (item.source && (item.source.name || item.source.confidence)) {
    const sourceLine = el('div', 'source-line');
    const confText = sourceConfText(item.source.confidence);
    const sourceBtn = el('button', '', (item.source.name || '来源') + (confText ? ' · ' + confText : ''));
    sourceBtn.addEventListener('click', () => {
      const detail = extra.querySelector('.source-detail');
      if (detail) {
        detail.classList.toggle('hidden');
      } else {
        const d = el('div', 'source-detail', '来源：' + (item.source.name || '待补充') + (item.source.url ? '（' + item.source.url + '）' : '') + ' · ' + confText);
        extra.insertBefore(d, sourceLine.nextSibling);
      }
    });
    sourceLine.appendChild(sourceBtn);
    extra.appendChild(sourceLine);
  }
  if (item.category === 'event') {
    extra.appendChild(el('div', 'source-line', '这是一次特殊事件，不属于事实类别。'));
  }
  card.appendChild(extra);

  // 相关内容
  computeRelated(item).then(list => {
    if (!list.length) return;
    const row = el('div', 'related-row');
    row.appendChild(el('span', 'related-label', '相关'));
    list.forEach(rel => {
      const chip = el('button', 'rel-chip', rel.item.layers.teaser.slice(0, 18) + (rel.item.layers.teaser.length > 18 ? '…' : ''));
      chip.title = rel.item.layers.teaser;
      chip.addEventListener('click', async () => {
        startChain();
        record(rel.item, 'chain');
        renderCard({ kind: 'item', item: rel.item, via: 'chain' });
        handleEvents();
      });
      row.appendChild(chip);
    });
    card.appendChild(row);
  });

  // 动作行
  const actions = el('div', 'card-actions');
  const favBtn = el('button', 'act-btn' + (state.favorites.some(f => f.id === item.id) ? ' active' : ''), '♥ 收藏');
  favBtn.addEventListener('click', () => {
    const added = addFavorite(item);
    favBtn.classList.toggle('active', added);
    toast(added ? '已收藏 · 去档案里找它' : '已取消收藏');
    handleEvents();
    renderDrawerAll();
  });
  actions.appendChild(favBtn);

  const dislikeBtn = el('button', 'act-btn', '✕ 不感兴趣');
  dislikeBtn.addEventListener('click', () => {
    markDislike(item);
    toast('已记录，这类会少一些');
    doPick();
  });
  actions.appendChild(dislikeBtn);

  if (why || deep) {
    const deepBtn = el('button', 'act-btn', '↳ 深入了解');
    deepBtn.addEventListener('click', () => {
      const expands = Array.from(card.querySelectorAll('.expand'));
      const unopened = expands.filter(sec => !sec.classList.contains('open'));
      if (unopened.length) {
        unopened.forEach(sec => {
          sec.classList.add('open');
          sec.classList.add('flash');
          setTimeout(() => sec.classList.remove('flash'), 1100);
          markDeep();
        });
        deepBtn.textContent = '✓ 已展开';
        deepBtn.disabled = true;
        deepBtn.classList.add('active');
        unopened[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        toast('已展开更深的解释');
      } else if (expands.length) {
        deepBtn.textContent = '✓ 已展开';
        deepBtn.disabled = true;
        deepBtn.classList.add('active');
        toast('已经展开到底了');
      }
    });
    actions.appendChild(deepBtn);
  }

  const shareBtn = el('button', 'act-btn', '分享');
  shareBtn.addEventListener('click', async () => {
    const url = location.origin + location.pathname + '?c=' + item.id;
    const text = '【下一件 · 奇怪事物档案馆】\n' + teaser + '\n' + url;
    try {
      await navigator.clipboard.writeText(text);
      toast('已复制，可以发给朋友');
    } catch (e) {
      toast('分享：' + text);
    }
  });
  actions.appendChild(shareBtn);
  card.appendChild(actions);

  // 再来一个
  const nextRow = el('div', 'next-row');
  const nextBtn = el('button', 'next-btn', '再来一个 →');
  nextBtn.addEventListener('click', doPick);
  nextRow.appendChild(nextBtn);
  card.appendChild(nextRow);

  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function appendExpandable(container, label, text, level) {
  if (!text) return;
  const btn = el('button', 'expand-btn', '▾ ' + label);
  const box = el('div', 'expand');
  const inner = el('div', 'expand-inner');
  inner.appendChild(el('p', 'body-text', text));
  box.appendChild(inner);
  btn.addEventListener('click', () => {
    box.classList.add('open');
    box.classList.add('flash');
    setTimeout(() => box.classList.remove('flash'), 1100);
    markDeep();
    btn.style.display = 'none';
  });
  container.appendChild(btn);
  container.appendChild(box);
}

function sourceConfText(conf) {
  return {
    verified: '可靠来源',
    widely_accepted: '学界共识',
    disputed: '存在争议',
    legend: '传说',
    anecdote: '轶事'
  }[conf] || '';
}

async function computeRelated(item) {
  const list = [];
  if (item.related && item.related.length) {
    for (const r of item.related.slice(0, 3)) {
      const it = await findItemById(r.id);
      if (it) list.push({ item: it });
    }
  }
  if (list.length < 3 && item.category && item.category !== 'event') {
    const items = (await getCategoryItems(item.category)).filter(i => i.id !== item.id && i.status === 'published');
    const scored = items
      .map(i => ({ i, s: (i.tags || []).filter(t => (item.tags || []).includes(t)).length }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s);
    for (const x of scored) {
      if (list.length >= 3) break;
      if (!list.find(l => l.item.id === x.i.id)) list.push({ item: x.i });
    }
  }
  return list;
}

function showIntro() {
  document.getElementById('intro').classList.remove('hidden');
  document.getElementById('card').classList.add('hidden');
}

// ---------- 事件处理（成就 / 稀有 / 人格） ----------

function handleEvents() {
  const events = drainEvents();
  events.forEach(e => {
    if (e.type === 'achievement') {
      const a = ACH_MAP[e.id];
      if (a) toast('成就解锁：' + a.icon + ' ' + a.name);
    }
    if (e.type === 'rare') {
      toast('✦ 你遇到了罕见内容');
    }
    if (e.type === 'toast') {
      toast(e.text);
    }
    if (e.type === 'profile') {
      showProfileModal(e.profile);
    }
  });
  renderDrawerAll();
}

const ACH_MAP = {
  first_click: { icon: '✦', name: '第一次遇见' },
  ten_clicks: { icon: '☕', name: '十件见闻' },
  hundred_clicks: { icon: '🌌', name: '百件见闻' },
  first_fav: { icon: '♥', name: '一见钟情' },
  ten_fav: { icon: '💎', name: '私人藏品' },
  explorer: { icon: '🗺', name: '十方世界' },
  rare_hunter: { icon: '✨', name: '稀有目击' },
  rare_x3: { icon: '🌠', name: '幸运星' },
  streak_3: { icon: '🔥', name: '三日之约' },
  streak_7: { icon: '🌟', name: '一周一见' },
  series_any: { icon: '✉', name: '收信人' },
  capsule_sent: { icon: '⏳', name: '寄给未来' },
  deep_diver: { icon: '🕳', name: '深潜者' }
};

// ---------- 皮肤 ----------

function toggleTheme() {
  const state = getState();
  state.theme = state.theme === 'archive' ? 'paper' : 'archive';
  save();
  applyTheme(state.theme);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

// ---------- 抽屉 ----------

function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'false');
  document.getElementById('drawer-backdrop').classList.remove('hidden');
  renderDrawerAll();
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'true');
  document.getElementById('drawer-backdrop').classList.add('hidden');
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  renderTab(name);
}

function renderDrawerAll() {
  if (!document.getElementById('drawer').classList.contains('open')) return;
  renderTab('history');
  renderTab('favorites');
  renderTab('stats');
  renderTab('achievements');
  renderTab('today');
}

function renderTab(name) {
  const state = getState();
  const panel = document.getElementById('tab-' + name);
  if (!panel) return;
  panel.innerHTML = '';

  if (name === 'history') {
    if (!state.history.length) {
      panel.appendChild(el('p', 'empty-note', '还没有历史。点一下"随机一下"吧。'));
      return;
    }
    state.history.slice(0, 60).forEach(h => {
      const row = el('div', 'hist-item');
      const time = new Date(h.ts);
      const meta = el('div', 'hist-meta', (catLabels[h.category] || '事件') + ' · ' + time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      row.appendChild(meta);
      row.appendChild(el('div', 'hist-text', h.teaser));
      panel.appendChild(row);
    });
  }

  if (name === 'favorites') {
    if (!state.favorites.length) {
      panel.appendChild(el('p', 'empty-note', '收藏夹还空着。遇到喜欢的，点 ♥。'));
      return;
    }
    state.favorites.forEach(f => {
      const row = el('div', 'fav-item');
      const textWrap = el('div', '');
      textWrap.appendChild(el('div', 'hist-meta', catLabels[f.category] || ''));
      textWrap.appendChild(el('div', 'fav-text', f.teaser));
      const act = el('div', 'fav-actions');
      const del = el('button', '', '移除');
      del.addEventListener('click', async () => {
        const item = await findItemById(f.id);
        if (item) addFavorite(item);
        renderDrawerAll();
      });
      act.appendChild(del);
      row.appendChild(textWrap);
      row.appendChild(act);
      panel.appendChild(row);
    });
  }

  if (name === 'stats') {
    const grid = el('div', 'stat-grid');
    const boxes = [
      ['点击次数', state.stats.clicks],
      ['收藏', state.favorites.length],
      ['探索类别', Object.keys(state.stats.categoriesExplored).length + ' / ' + getManifest().categories.length],
      ['罕见内容', state.stats.rareSeen],
      ['连续天数', state.streak + ' 天'],
      ['深入了解', state.stats.deepCount + ' 次']
    ];
    boxes.forEach(([label, num]) => {
      const box = el('div', 'stat-box');
      box.appendChild(el('div', 'stat-num', String(num)));
      box.appendChild(el('div', 'stat-label', label));
      grid.appendChild(box);
    });
    panel.appendChild(grid);
    if (state.lastProfile) {
      panel.appendChild(el('div', 'coincidence-note', '最近一次人格报告：' + state.lastProfile.title));
    }
  }

  if (name === 'achievements') {
    const all = [
      ['first_click', '✦', '第一次遇见', '按下第一次"随机一下"'],
      ['ten_clicks', '☕', '十件见闻', '累计点击 10 次'],
      ['hundred_clicks', '🌌', '百件见闻', '累计点击 100 次'],
      ['first_fav', '♥', '一见钟情', '收藏第一件内容'],
      ['ten_fav', '💎', '私人藏品', '收藏 10 件内容'],
      ['explorer', '🗺', '十方世界', '探索过 10 个不同类别'],
      ['rare_hunter', '✨', '稀有目击', '遇到 1 件罕见内容'],
      ['rare_x3', '🌠', '幸运星', '遇到 3 件罕见内容'],
      ['streak_3', '🔥', '三日之约', '连续 3 天都按过'],
      ['streak_7', '🌟', '一周一见', '连续 7 天都按过'],
      ['series_any', '✉', '收信人', '完成一个系列'],
      ['capsule_sent', '⏳', '寄给未来', '给未来的自己留了一句话'],
      ['deep_diver', '🕳', '深潜者', '深入了解 20 次']
    ];
    all.forEach(([id, icon, name, desc]) => {
      const unlocked = state.achievements.includes(id);
      const row = el('div', 'ach-item' + (unlocked ? '' : ' locked'));
      row.appendChild(el('span', 'ach-icon', unlocked ? icon : '·'));
      const wrap = el('div', '');
      wrap.appendChild(el('div', 'ach-name', name));
      wrap.appendChild(el('div', 'ach-desc', desc));
      row.appendChild(wrap);
      panel.appendChild(row);
    });
  }

  if (name === 'today') {
    const theme = getTodayTheme();
    const hero = el('div', 'today-hero');
    hero.appendChild(el('div', 'hist-meta', '今日发现'));
    hero.appendChild(el('div', 'today-theme', theme.label));
    hero.appendChild(el('div', 'today-num', theme.desc));
    hero.appendChild(el('div', 'today-num', '今天已遇见 ' + state.todayIds.length + ' 件 · 连续 ' + state.streak + ' 天'));
    panel.appendChild(hero);
    if (state.notes.length) {
      panel.appendChild(el('p', 'empty-note', '你还有 ' + state.notes.length + ' 个时间胶囊在路上。'));
    }
  }
}

// ---------- 弹窗与提示 ----------

function openCapsuleModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('hidden');
  const box = el('div', 'modal-box');
  box.appendChild(el('h2', '', '给未来的自己留一句话'));
  box.appendChild(el('p', '', '它会在 7 天或 30 天后，以"来自过去的你"的身份随机出现一次。只存在你自己的浏览器里。'));
  const ta = document.createElement('textarea');
  ta.placeholder = '写点什么……';
  box.appendChild(ta);
  const daysRow = el('div', 'capsule-days');
  const r7 = el('label', '', '');
  const i7 = document.createElement('input');
  i7.type = 'radio';
  i7.name = 'capsule-days';
  i7.value = '7';
  i7.checked = true;
  r7.appendChild(i7);
  r7.appendChild(document.createTextNode('7 天后'));
  const r30 = el('label', '', '');
  const i30 = document.createElement('input');
  i30.type = 'radio';
  i30.name = 'capsule-days';
  i30.value = '30';
  r30.appendChild(i30);
  r30.appendChild(document.createTextNode('30 天后'));
  daysRow.appendChild(r7);
  daysRow.appendChild(r30);
  box.appendChild(daysRow);
  const actions = el('div', 'modal-actions');
  const cancel = el('button', '', '算了');
  cancel.addEventListener('click', closeModal);
  const ok = el('button', 'primary', '寄出去');
  ok.addEventListener('click', () => {
    const text = ta.value.trim();
    if (!text) {
      toast('先写一句话吧');
      return;
    }
    const days = document.querySelector('input[name="capsule-days"]:checked').value;
    addCapsuleNote(text, Number(days));
    closeModal();
    toast('已寄出 · ' + days + ' 天后见');
    handleEvents();
    renderDrawerAll();
  });
  actions.appendChild(cancel);
  actions.appendChild(ok);
  box.appendChild(actions);
  modal.innerHTML = '';
  modal.appendChild(box);
  ta.focus();
}

function showProfileModal(profile) {
  const modal = document.getElementById('modal');
  modal.classList.remove('hidden');
  const box = el('div', 'modal-box');
  box.appendChild(el('h2', '', profile.title));
  profile.lines.forEach(line => box.appendChild(el('p', '', line)));
  const actions = el('div', 'modal-actions');
  const ok = el('button', 'primary', '继续探索');
  ok.addEventListener('click', closeModal);
  actions.appendChild(ok);
  box.appendChild(actions);
  modal.innerHTML = '';
  modal.appendChild(box);
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('modal').innerHTML = '';
}

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 350);
  }, 2600);
}


/* ========== app.js ========== */
// 入口：启动网站




async function boot() {
  try {
    await initData();
    initUI();

    // 离线支持（仅部署到网站时生效，双击打开 index.html 不影响）
    if (location.protocol === 'https:' || location.protocol === 'http:') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      }
    }

    // 预加载最常见的几个类别，第一次点击秒出
    preloadCategories(['animals', 'weird_events', 'space', 'human', 'history', 'stories']);

    // 深链：?c=ID 直达某条内容（分享功能）
    const params = new URLSearchParams(location.search);
    const id = params.get('c');
    if (id) {
      showDeepLink(id);
      return;
    }
  } catch (e) {
    console.error(e);
    const hint = document.querySelector('.hint');
    if (hint) hint.textContent = '内容清单加载失败：' + e.message;
  }
}

boot();

