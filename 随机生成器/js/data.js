// 数据加载：优先读取 data/*.json；file:// 直开时回退到内嵌数据（js/embedded-data.js）
let manifest = null;
let embedded = null;
let mode = 'remote';
const cache = {};

export async function initData() {
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

export function getManifest() {
  return manifest;
}

export function isEmbedded() {
  return mode === 'embedded';
}

export async function getCategoryItems(key) {
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

export async function findItemById(id) {
  const map = manifest.idToCat || {};
  const key = map[id];
  if (!key) return null;
  const items = await getCategoryItems(key);
  return items.find(i => i.id === id) || null;
}

export async function preloadCategories(keys) {
  await Promise.all(keys.map(key => getCategoryItems(key).catch(() => null)));
}
