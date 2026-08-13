// 生成 data/index.json：类别清单、条数、id 索引
// 用法：node tools/build-index.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const CATS = [
  { key: 'animals', label: '动物与植物', file: 'animals.json', weight: 9 },
  { key: 'nature', label: '自然科学', file: 'nature.json', weight: 7 },
  { key: 'human', label: '人体与医学', file: 'human.json', weight: 6 },
  { key: 'psychology', label: '心理与认知', file: 'psychology.json', weight: 5 },
  { key: 'history', label: '历史', file: 'history.json', weight: 6 },
  { key: 'geography', label: '地理与世界', file: 'geography.json', weight: 4 },
  { key: 'tech', label: '科技与互联网', file: 'tech.json', weight: 4 },
  { key: 'language', label: '语言', file: 'language.json', weight: 2 },
  { key: 'math', label: '数学', file: 'math.json', weight: 2 },
  { key: 'space', label: '宇宙', file: 'space.json', weight: 2 },
  { key: 'weird_events', label: '奇怪真实事件', file: 'weird_events.json', weight: 6 },
  { key: 'philosophy', label: '哲学与思维实验', file: 'philosophy.json', weight: 5 },
  { key: 'society', label: '社会与生活观察', file: 'society.json', weight: 5 },
  { key: 'strange_questions', label: '奇怪问题', file: 'strange_questions.json', weight: 4 },
  { key: 'stories', label: '故事', file: 'stories.json', weight: 2 },
  { key: 'fiction_archive', label: '虚构档案', file: 'fiction_archive.json', weight: 4 },
  { key: 'brainstorm', label: '脑洞与离谱设定', file: 'brainstorm.json', weight: 5 },
  { key: 'quotes', label: '句子', file: 'quotes.json', weight: 3 },
  { key: 'mind_games', label: '思维游戏', file: 'mind_games.json', weight: 3 },
  { key: 'choices', label: '两难选择', file: 'choices.json', weight: 3 },
  { key: 'counterfactual', label: '反事实历史与如果系列', file: 'counterfactual.json', weight: 3 },
  { key: 'challenges', label: '随机挑战', file: 'challenges.json', weight: 2 },
  { key: 'unsolved', label: '未解之谜', file: 'unsolved.json', weight: 2 },
  { key: 'lost_things', label: '消失的东西', file: 'lost_things.json', weight: 2 },
  { key: 'odd_corners', label: '冷门角落', file: 'odd_corners.json', weight: 2 }
];

const VALID_FACTUAL = ['FACT', 'HISTORY', 'SCIENCE', 'OPINION', 'THOUGHT_EXPERIMENT', 'COUNTERFACTUAL', 'FICTION', 'LEGEND', 'HUMOR', 'QUESTION', 'TASK', 'SYSTEM', 'CAPSULE'];
const VALID_RARITY = ['COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE', 'SECRET', 'MYTHIC'];

const out = {
  version: '0.1.0',
  schema_version: 1,
  generated: new Date().toISOString().slice(0, 10),
  categories: [],
  total: 0,
  idToCat: {}
};

const errors = [];
const warnings = [];

for (const c of CATS) {
  const fp = path.join(DATA_DIR, c.file);
  if (!fs.existsSync(fp)) {
    errors.push('缺少数据文件：' + c.file);
    continue;
  }
  let items;
  try {
    items = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    errors.push('JSON 解析失败：' + c.file + ' → ' + e.message);
    continue;
  }
  if (!Array.isArray(items)) {
    errors.push('不是数组：' + c.file);
    continue;
  }
  const ids = new Set();
  for (const it of items) {
    if (!it.id) { errors.push(c.file + ' 缺少 id 的条目'); continue; }
    if (ids.has(it.id)) errors.push('重复 id：' + it.id);
    ids.add(it.id);
    out.idToCat[it.id] = c.key;

    if (!it.category || it.category !== c.key) warnings.push(it.id + '：category 与文件名不一致');
    if (!VALID_FACTUAL.includes(it.factual_type)) warnings.push(it.id + '：factual_type 不在白名单（' + it.factual_type + '）');
    if (!VALID_RARITY.includes(it.rarity)) warnings.push(it.id + '：rarity 不在白名单（' + it.rarity + '）');
    if (!it.layers || !it.layers.teaser) errors.push(it.id + '：缺少 layers.teaser');
    if (['SCIENCE', 'FACT', 'HISTORY'].includes(it.factual_type) && !(it.source && it.source.name)) {
      warnings.push(it.id + '：事实类内容缺少来源');
    }
    if (['FICTION', 'LEGEND'].includes(it.factual_type) && it.factual_type === 'FICTION' && !it.layers.teaser) {
      // teaser 已有检查，这里只是占位
    }
  }
  out.categories.push({
    key: c.key,
    label: c.label,
    file: 'data/' + c.file,
    count: items.length,
    weight: c.weight
  });
  out.total += items.length;
}

fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(out, null, 2));

console.log('total items:', out.total);
if (errors.length) {
  console.log('ERRORS (' + errors.length + '):');
  errors.forEach(e => console.log('  - ' + e));
} else {
  console.log('结构校验：通过（无错误）');
}
if (warnings.length) {
  console.log('WARNINGS (' + warnings.length + '):');
  warnings.slice(0, 20).forEach(w => console.log('  - ' + w));
  if (warnings.length > 20) console.log('  … 共 ' + warnings.length + ' 条警告');
}
