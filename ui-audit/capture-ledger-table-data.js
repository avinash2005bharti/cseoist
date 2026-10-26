import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'verified_tg_fixes');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));
  const tgAuth = authTokens.tg;

  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    const expr = `
      localStorage.setItem('campusflow_token', ${JSON.stringify(tgAuth.token)});
      localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(tgAuth.user))});
      localStorage.setItem('campusflow_role', ${JSON.stringify(tgAuth.role)});
    `;
    await cdp.send('Runtime.evaluate', { expression: expr });

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg` });
    await sleep(2500);

    // Open ledger
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent.includes('View Records'));
          if (btn) btn.click();
        })()
      `
    });
    await sleep(2000);

    // Open date picker
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const prevBtn = btns.find(b => b.textContent.includes('Show Previous Considerations'));
          if (prevBtn) prevBtn.click();
        })()
      `
    });
    await sleep(1000);

    // Click "Apply & View Records"
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const applyBtn = btns.find(b => b.textContent.includes('Apply & View Records'));
          if (applyBtn) applyBtn.click();
        })()
      `
    });
    await sleep(3000);

    await captureScreenshot(cdp, path.join(OUTPUT_DIR, '4-tg-ledger-table-data-rows.png'), { width: 1440, height: 900 });
    console.log('Saved 4-tg-ledger-table-data-rows.png');
  } finally {
    chromeProc.kill();
  }
}

main();
