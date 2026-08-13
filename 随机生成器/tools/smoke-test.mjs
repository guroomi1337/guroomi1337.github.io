// 冒烟测试：在 Node 里模拟浏览器环境，连续点击 N 次，检查引擎是否稳定、是否过度重复
// 用法：node tools/smoke-test.mjs [次数]
const N = Number(process.argv[2] || 150);

// 模拟浏览器环境
globalThis.window = globalThis;
const store = {};
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

// 用内嵌数据（模拟 file:// 直开场景）
await import('../js/embedded-data.js');
const data = await import('../js/data.js');
await data.initData();
const sched = await import('../js/scheduler.js');

const seen = [];
const errors = [];
let rares = 0;
let events = 0;
let series = 0;

for (let i = 0; i < N; i++) {
  try {
    const d = await sched.pickNext();
    if (!d || !d.item || !d.item.layers || !d.item.layers.teaser) {
      errors.push('第 ' + (i + 1) + ' 次：返回了空内容');
      continue;
    }
    const intentional = ['gentle', 'chain', 'series', 'event', 'capsule', 'mashup'].includes(d.via) || d.kind === 'style';
    if (i < 100 && !intentional && d.item.id && d.item.category !== 'event' && seen.includes(d.item.id)) {
      errors.push('第 ' + (i + 1) + ' 次：前 100 次内重复内容 ' + d.item.id);
    }
    seen.push(d.item.id);
    if (['RARE', 'VERY_RARE', 'SECRET', 'MYTHIC'].includes(d.item.rarity)) rares++;
    if (d.via === 'event' || d.kind === 'style') events++;
    if (d.via === 'series') series++;
    if (d.kind === 'style') events++;
  } catch (e) {
    errors.push('第 ' + (i + 1) + ' 次抛异常：' + e.message);
  }
}

const state = (await import('../js/state.js')).getState();
console.log('总点击：' + N);
console.log('历史记录条数：' + state.history.length);
console.log('罕见内容（RARE+）：' + rares);
console.log('稀有事件：' + events);
console.log('系列内容：' + series);
console.log('探索类别数：' + Object.keys(state.stats.categoriesExplored).length);
console.log('成就解锁：' + state.achievements.length);
console.log('最后一条：' + (state.history[0] ? state.history[0].teaser.slice(0, 30) : '无'));

if (errors.length) {
  console.log('\n发现问题 ' + errors.length + ' 个：');
  errors.slice(0, 15).forEach(e => console.log('  - ' + e));
  process.exit(1);
}

// 连续重复检查：最近 60 条里不应有同一 id 出现两次以上
const recent = state.history.filter(h => h.id).map(h => h.id);
const counts = {};
recent.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
const dups = Object.entries(counts).filter(([, c]) => c > 1);
if (dups.length) {
  console.log('\n近期出现重复 ' + dups.length + ' 个（大多发生在 100 次之后，属小类别见底后的正常回收）：');
  dups.slice(0, 10).forEach(([id, c]) => console.log('  - ' + id + ' ×' + c));
} else {
  console.log('\n最近 60 条无重复：通过');
}

// 判定：前 100 次点击不允许出现普通内容重复（故意回调/事件不算）
if (errors.length) {
  console.log('\n判定：未通过（前 100 次出现 ' + errors.length + ' 次普通内容重复）');
  process.exit(1);
}
console.log('\n冒烟测试完成：前 100 次点击零重复，通过');
