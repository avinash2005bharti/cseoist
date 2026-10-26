import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'verified_ledger');

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
  const hodAuth = authTokens.hod;

  console.log('Capturing verified Ledger views...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, hodAuth);

    // 1. Desktop Ledger Modal (1440x900) -> Screen 19
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Emulation.setVisibleSize', { width: 1440, height: 900 });
    await cdp.send('Page.navigate', { url: `${APP_BASE}/hod?open_ledger=true` });
    await sleep(3500);

    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'screen-19-desktop.png'), { width: 1440, height: 900 });
    console.log('Saved screen-19-desktop.png');

    // 2. Mobile Ledger Modal (375x812) -> Screen 20
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send('Emulation.setVisibleSize', { width: 375, height: 812 });
    await cdp.send('Page.navigate', { url: `${APP_BASE}/hod?open_ledger=true` });
    await sleep(3500);

    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'screen-20-mobile.png'), { width: 375, height: 812 });
    console.log('Saved screen-20-mobile.png');

    console.log('All ledger verification captures completed successfully!');
  } catch (err) {
    console.error('Capture error:', err);
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch(console.error);
