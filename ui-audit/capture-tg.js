import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'after');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const VIEWPORTS = [
  { name: '1440px', width: 1440, height: 900 },
  { name: '1024px', width: 1024, height: 768 },
  { name: '768px', width: 768, height: 1024 },
  { name: '375px', width: 375, height: 812 },
];

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

  console.log('Starting targeted TG capture...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, tgAuth);

    const tgPages = [
      { name: 'tg-requests', path: '/tg/requests' },
      { name: 'tg-students', path: '/tg/students' },
    ];

    for (const page of tgPages) {
      for (const vp of VIEWPORTS) {
        console.log(`Capturing ${page.name} at ${vp.name}...`);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.width < 768,
        });
        await cdp.send('Page.navigate', { url: `${APP_BASE}${page.path}` });
        await sleep(2500);

        const screenshotFile = path.join(OUTPUT_DIR, `${page.name}-${vp.name}.png`);
        await captureScreenshot(cdp, screenshotFile, vp);
      }
    }

    cdp.close();
    console.log('TG captures completed successfully!');
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
