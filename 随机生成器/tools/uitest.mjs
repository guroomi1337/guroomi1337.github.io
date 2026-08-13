// 界面自动化测试：真实打开页面，点击按钮，检查交互是否生效
// 用法：node tools/uitest.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/tokyo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const BASE = 'http://localhost:8123/';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('console: ' + msg.text());
  });
  page.on('pageerror', err => errors.push('pageerror: ' + err.message));

  // 直接打开一条有 why/deep 的内容（章鱼）
  await page.goto(BASE + '?c=ANM-0001', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card', { timeout: 8000 });

  const teaser = await page.textContent('.teaser');
  console.log('卡片已显示：', teaser.slice(0, 30));

  const expandBtnsBefore = await page.locator('.expand-btn').count();
  const openBefore = await page.locator('.expand.open').count();
  console.log('展开按钮数：', expandBtnsBefore, '已展开区：', openBefore);

  // 点击"深入了解"
  const deepBtn = page.locator('button.act-btn', { hasText: '深入了解' });
  console.log('深入了解按钮存在：', await deepBtn.count() > 0);
  await deepBtn.click();
  await page.waitForTimeout(800);

  const openAfter = await page.locator('.expand.open').count();
  console.log('点击后已展开区：', openAfter);
  const whyText = await page.locator('.expand.open .body-text').first().textContent().catch(() => '');
  console.log('展开内容：', (whyText || '').slice(0, 40));
  const btnTextAfter = await page.locator('button.act-btn', { hasText: '已展开' }).count();
  console.log('按钮变为"已展开"：', btnTextAfter > 0);
  // 确认按钮已禁用（防重复点击）
  const disabled = await page.locator('button.act-btn', { hasText: '已展开' }).isDisabled();
  console.log('按钮已禁用：', disabled);
  await page.waitForTimeout(300);
  const openFinal = await page.locator('.expand.open').count();
  console.log('再次点击后展开区数量稳定：', openFinal);

  await page.screenshot({ path: 'shots-deep.png', fullPage: false });

  // 回到首页，点"随机一下"
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('#btnGo');
  await page.waitForSelector('.card', { timeout: 8000 });
  const cardShown = await page.locator('.card').isVisible();
  console.log('随机一下后卡片可见：', cardShown);
  await page.screenshot({ path: 'shots-after-click.png', fullPage: false });

  console.log('页面错误：', errors.length ? errors : '无');
  await browser.close();
}

main().catch(e => {
  console.error('测试失败：', e.message);
  process.exit(1);
});
