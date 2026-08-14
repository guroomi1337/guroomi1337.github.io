// 界面渲染与交互
import { getManifest, getCategoryItems, findItemById } from './data.js';
import { getState, save } from './state.js';
import {
  RARITY_LABEL,
  TYPE_LABEL,
  getSeriesItem,
  SERIES
} from './meta.js';
import {
  pickNext,
  drainEvents,
  getTodayTheme,
  startChain,
  exitChain,
  markDeep,
  addFavorite,
  markDislike,
  addCapsuleNote,
  checkAchievements,
  record
} from './scheduler.js';

let catLabels = {};

export function initUI() {
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

export async function doPick() {
  const btn = document.getElementById('btnGo');
  if (btn && !btn.disabled) {
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 180);
  }
  const display = await pickNext();
  renderCard(display);
  handleEvents();
}

export async function showDeepLink(id) {
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

export function showIntro() {
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

export function renderDrawerAll() {
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
export function toast(msg) {
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
