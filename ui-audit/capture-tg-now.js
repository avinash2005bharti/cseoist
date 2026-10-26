import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'current_tg');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setAuth(cdp, authData) {
  const expr = `
    localStorage.setItem('campusflow_token', ${JSON.stringify(authData.token)});
    localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authData.user))});
    localStorage.setItem('campusflow_role', ${JSON.stringify(authData.role)});
  `;
  await cdp.send('Runtime.evaluate', { expression: expr });
}

async function main() {
  const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));
  const tgAuth = authTokens.tg;

  console.log('Capturing current TG state...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, tgAuth);

    // 1. Desktop TG Dashboard (1440x900)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg` });
    await sleep(2000);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'tg-dashboard-desktop.png'));

    // 2. Mobile TG Dashboard (375x812)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg` });
    await sleep(2000);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'tg-dashboard-mobile.png'));

    // 3. Desktop TG Requests (1440x900)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg/requests` });
    await sleep(2000);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'tg-requests-desktop.png'));

    // 4. Mobile TG Requests (375x812)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg/requests` });
    await sleep(2000);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'tg-requests-mobile.png'));

    cdp.close();
    console.log('Done capturing current TG state!');
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch(console.error);
