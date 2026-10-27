import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'verification_hod');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setAuth(cdp, authData) {
  const expr = `
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('campusflow_token', ${JSON.stringify(authData.token)});
    localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authData.user))});
    localStorage.setItem('campusflow_role', ${JSON.stringify(authData.role)});
  `;
  await cdp.send('Runtime.evaluate', { expression: expr });
}

async function run() {
  const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));
  const hodAuth = authTokens.hod;

  console.log('Testing HOD TG recommendations card layout and toast notifications...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, hodAuth);

    // 1. Navigate to HOD TG Recommendations page at 1440x900 (Desktop)
    await cdp.send('Page.navigate', { url: `${APP_BASE}/hod/tg-recommendations` });
    await sleep(2500);

    // Capture TG Recommendations desktop layout
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'hod-tg-recommendations-desktop.png'), { width: 1440, height: 900 });

    // Capture TG Recommendations mobile layout scrolled to card
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const card = document.querySelector('.hod-info-grid') || document.querySelector('.hod-app-card');
        if (card) card.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await sleep(400);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'hod-tg-recommendations-mobile.png'), { width: 390, height: 844 });
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        window.scrollTo(0, 0);
        const main = document.querySelector('main');
        if (main) main.scrollTo(0, 0);
      })()`
    });
    await sleep(200);

    // 2. Trigger real green and red toasts via window.__campusflow_addToast
    console.log('Triggering real toast messages in browser...');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        if (window.__campusflow_addToast) {
          window.__campusflow_addToast('Test Reminder Dispatched', 'Sent MIDDAY reminder to all TGs and HODs.', 'success');
          window.__campusflow_addToast('Midday Attendance & Consideration Reminder', 'Please review pending student consideration requests (6 in queue).', 'warning');
        }
      })()`
    });

    await sleep(600);
    // Capture screenshot with the live toasts visible
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'hod-toasts-live.png'), { width: 1440, height: 900 });

    // Inspect the close buttons
    const toastCheck = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('.toast-close-btn'));
        return btns.map(b => {
          const comp = window.getComputedStyle(b);
          const svg = b.querySelector('svg');
          const compSvg = svg ? window.getComputedStyle(svg) : null;
          return {
            bg: comp.backgroundColor,
            color: comp.color,
            svgStroke: compSvg ? compSvg.stroke : null,
            svgColor: compSvg ? compSvg.color : null,
            width: comp.width,
            height: comp.height
          };
        });
      })()`,
      returnByValue: true
    });

    console.log('Toast close buttons inspection:', JSON.stringify(toastCheck.result?.value, null, 2));

    console.log('Toast close buttons inspection:', JSON.stringify(toastCheck.result?.value, null, 2));

    cdp.close();
    console.log('All verification captures completed!');
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

run().catch(console.error);
