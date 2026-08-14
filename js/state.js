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

export function getState() {
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // 存储不可用时静默（比如隐私模式）
  }
}

export function resetAll() {
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  save();
}

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function refreshDay() {
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
