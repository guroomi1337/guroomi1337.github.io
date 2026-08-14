// 随机调度器：有记忆的随机
import { getManifest, getCategoryItems, findItemById } from './data.js';
import { getState, save, todayStr, refreshDay } from './state.js';
import {
  RARITY_WEIGHT,
  SERIES,
  THEMES,
  randInt,
  weightedPick,
  getSeriesItem
} from './meta.js';
import { rollEvent } from './rare.js';

let eventQueue = [];

function emit(e) {
  eventQueue.push(e);
}

export function drainEvents() {
  const e = eventQueue;
  eventQueue = [];
  return e;
}

export function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

export function getTodayTheme() {
  return THEMES[dayOfYear() % THEMES.length];
}

export async function pickNext() {
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

export function record(item, via) {
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

export function startChain() {
  const state = getState();
  state.chain = { depth: 1 };
  save();
}

export function exitChain() {
  const state = getState();
  state.chain = null;
  save();
}

export function markDeep() {
  const state = getState();
  state.stats.deepCount += 1;
  checkAchievements();
  save();
}

export function addFavorite(item) {
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

export function markDislike(item) {
  const state = getState();
  state.disCat[item.category] = (state.disCat[item.category] || 0) + 1;
  state.stats.disliked += 1;
  save();
}

export function addCapsuleNote(text, days) {
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

export function checkAchievements() {
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

export function buildProfile() {
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

import { PERSONA } from './meta.js';
