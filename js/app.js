// 入口：启动网站
import { initData, preloadCategories } from './data.js';
import { initUI, doPick, showDeepLink } from './ui.js';
import { getState } from './state.js';

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
