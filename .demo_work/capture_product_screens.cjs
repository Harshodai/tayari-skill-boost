const { chromium } = require('playwright');
const fs = require('fs/promises');
const path = require('path');

const output = process.argv[2];
if (!output) throw new Error('Pass an output directory');

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

  const captures = [
    ['landing', 'http://127.0.0.1:8083/'],
    ['pricing', 'http://127.0.0.1:8083/pricing'],
    ['desktop', 'http://127.0.0.1:8083/desktop'],
  ];

  for (const [name, url] of captures) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false });
  }

  await browser.close();
})();
