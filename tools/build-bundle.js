// 把 ES 模块源码合成一个普通脚本 js/bundle.js，保证双击 index.html 也能在所有浏览器运行
// 用法：node tools/build-bundle.js
const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '..', 'js');
const FILES = ['data.js', 'state.js', 'meta.js', 'rare.js', 'scheduler.js', 'ui.js', 'app.js'];

let out = '// 下一件 · 自动打包生成，请勿手改此文件（源码在 js/*.js，改完跑 node tools/build-bundle.js）\n';

for (const f of FILES) {
  const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
  const cleaned = src
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"]\s*;/g, '')
    .replace(/import\s+[^'"]+?\s+from\s*['"][^'"]+['"]\s*;/g, '')
    .replace(/import\s*['"][^'"]+['"]\s*;/g, '')
    .split('\n')
    .map(line => line.replace(/^export\s+/, ''))
    .join('\n');
  out += '\n/* ========== ' + f + ' ========== */\n' + cleaned + '\n';
}

fs.writeFileSync(path.join(JS_DIR, 'bundle.js'), out);
console.log('bundle.js generated');
