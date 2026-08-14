// 生成 js/embedded-data.js：把全部数据内嵌，保证双击 index.html 也能离线使用
// 用法：先跑 build-index.js，再跑 node tools/build-embed.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'index.json'), 'utf8'));
const categories = {};

for (const c of index.categories) {
  categories[c.key] = JSON.parse(fs.readFileSync(path.join(__dirname, '..', c.file), 'utf8'));
}

const js = 'window.__EMBEDDED_DATA__ = ' + JSON.stringify({ manifest: index, categories }) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'js', 'embedded-data.js'), js);
console.log('embedded data OK:', index.total, 'items');
