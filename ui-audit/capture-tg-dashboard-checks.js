import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'dashboard-checks');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreen(cdp, filename, width = 1440, height = 900) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(500);

  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true
  });
  const fullPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(fullPath, Buffer.from(data, 'base64'));
  console.log(`Saved screenshot: ${filename} (${width}x${height})`);
}

async function run() {
  console.log('Running clean TG dashboard and requests capture...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await sleep(1500);

    // Hard logout
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
      `
    });
    await sleep(2000);

    // Select TG role tab
    await cdp.send('Runtime.evaluate', {
      expression: `
        const tabs = Array.from(document.querySelectorAll('.auth-role-tab'));
        const tgTab = tabs.find(t => t.textContent.trim().toUpperCase() === 'TG');
        if (tgTab) tgTab.click();
      `,
    });
    await sleep(600);

    // Enter email and password
    await cdp.send('Runtime.evaluate', {
      expression: `
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        if (emailInput && passInput) {
          nativeSetter.call(emailInput, 'test_teacher@mail.in');
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));

          nativeSetter.call(passInput, 'Password@123');
          passInput.dispatchEvent(new Event('input', { bubbles: true }));

          const btn = document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      `,
    });
    await sleep(4000);

    const currentUrlRes = await cdp.send('Runtime.evaluate', {
      expression: 'window.location.href',
      returnByValue: true,
    });
    console.log('Current URL after TG login:', currentUrlRes.result.value);

    // Capture TG Dashboard
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg` });
    await sleep(2500);
    await captureScreen(cdp, 'tg-dashboard-redesigned.png');

    // Capture TG Requests
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg/requests` });
    await sleep(2500);
    await captureScreen(cdp, 'tg-requests-redesigned.png');

    console.log('TG captures completed!');
    cdp.close();
  } finally {
    if (chromeProc) chromeProc.kill();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
