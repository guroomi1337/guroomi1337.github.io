// 稀有事件系统：极低概率，但绝不跳吓
import { getState } from './state.js';
import { HIDDEN_QUESTIONS, MYTHIC_TEXT, SERIES, mkSpecial, randInt, weightedPick, getSeriesItem } from './meta.js';

export async function rollEvent(state) {
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
