const { chromium } = require('playwright');
const fs = require('fs/promises');
const path = require('path');

const out = process.argv[2];
if (!out) throw new Error('Pass an output directory');

const captions = [
  { text: 'JOB SEARCH GETS NOISY.', width: 1020, size: 48 },
  { text: 'KEEP EVERY IMPORTANT ACTION IN VIEW.', width: 1340, size: 42 },
  { text: 'PREPARE. REVIEW. DECIDE.', width: 850, size: 43 },
  { text: 'NOTHING GOES OUT WITHOUT YOUR APPROVAL.', width: 1500, size: 40 },
  { text: 'EVERY ATTEMPT LEAVES A RECEIPT.', width: 1160, size: 42 },
  { text: 'ONE FOCUSED SYSTEM FOR THE SEARCH.', width: 1350, size: 42 },
  { text: 'WORK WITH A CLEAR RECORD.', width: 1040, size: 43 },
  { text: 'LESS CHASING. MORE CLARITY.', width: 950, size: 43 },
  { text: 'JOB TAYARI', sub: 'A SEARCH YOU CAN INSPECT.', width: 1260, size: 54 },
];

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  for (let i = 0; i < captions.length; i += 1) {
    const c = captions[i];
    const isFinal = Boolean(c.sub);
    await page.setContent(`<!doctype html><html><head><style>
      html,body{width:1920px;height:1080px;margin:0;background:transparent;overflow:hidden}
      .caption{position:absolute;left:120px;bottom:${isFinal ? '84px' : '96px'};width:${c.width}px;min-height:${isFinal ? 182 : 138}px;box-sizing:border-box;padding:30px;background:rgba(6,14,31,.86);font-family:Arial,sans-serif;color:#fff;font-weight:700;letter-spacing:.2px}
      .main{font-size:${c.size}px;line-height:1.13;white-space:nowrap}
      .sub{font-size:32px;line-height:1.1;color:#35D5FF;margin-top:11px;letter-spacing:1.1px}
    </style></head><body><div class="caption"><div class="main">${c.text}</div>${c.sub ? `<div class="sub">${c.sub}</div>` : ''}</div></body></html>`);
    await page.screenshot({ path: path.join(out, `caption_${String(i + 1).padStart(2, '0')}.png`), omitBackground: true });
  }
  await browser.close();
})();
