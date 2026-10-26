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

async function main() {
  console.log('Logging in as TG via UI...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await sleep(2000);

    // Select TG role tab
    await cdp.send('Runtime.evaluate', {
      expression: `
        const tabs = Array.from(document.querySelectorAll('.auth-role-tab'));
        const tgTab = tabs.find(t => t.textContent.includes('TG'));
        if (tgTab) tgTab.click();
      `,
    });
    await sleep(500);

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
    await sleep(3500);

    const currentUrlRes = await cdp.send('Runtime.evaluate', {
      expression: 'window.location.href',
      returnByValue: true,
    });
    console.log('Current URL after TG login:', currentUrlRes.result?.value);

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
    console.log('TG UI Captures completed!');
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
