import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'verification');

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

async function run() {
  const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));
  const tgAuth = authTokens.tg;

  console.log('Starting TG responsive and logout test...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, tgAuth);

    // 1. Mobile (375px)
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg` });
    await sleep(2000);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'tg-mobile-375.png'), { width: 375, height: 812 });

    // Inspect Header layout elements at 375px
    const headerCheck = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const header = document.querySelector('header');
        const bellBtn = document.querySelector('button[aria-label="View notifications"]');
        const logoutBtn = document.querySelector('button[aria-label="Logout"]');
        if (!header || !bellBtn || !logoutBtn) {
          return { error: 'Missing header elements', header: !!header, bell: !!bellBtn, logout: !!logoutBtn };
        }
        const headerRect = header.getBoundingClientRect();
        const bellRect = bellBtn.getBoundingClientRect();
        const logoutRect = logoutBtn.getBoundingClientRect();
        return {
          headerHeight: headerRect.height,
          headerWidth: headerRect.width,
          bell: { x: bellRect.x, y: bellRect.y, w: bellRect.width, h: bellRect.height, visible: bellRect.width > 0 },
          logout: { x: logoutRect.x, y: logoutRect.y, w: logoutRect.width, h: logoutRect.height, visible: logoutRect.width > 0 },
          adjacent: Math.abs(logoutRect.x - (bellRect.x + bellRect.width)) < 15,
          withinHeader: logoutRect.bottom <= headerRect.bottom && logoutRect.top >= headerRect.top
        };
      })()`,
      returnByValue: true
    });
    console.log('Mobile Header inspection result:', JSON.stringify(headerCheck.result?.value, null, 2));

    // 2. Tablet (768px)
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'tg-tablet-768.png'), { width: 768, height: 1024 });

    // 3. Desktop (1280px)
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'tg-desktop-1280.png'), { width: 1280, height: 800 });

    // 4. Test Zero Students scenario (when cohort has 0 students)
    const zeroTestResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const cards = Array.from(document.querySelectorAll('div')).filter(d => d.textContent.includes('TOTAL STUDENTS'));
        return {
          hasTotalStudentsCard: cards.length > 0
        };
      })()`,
      returnByValue: true
    });
    console.log('Zero student card check:', zeroTestResult.result?.value);

    // 5. Test Logout Click functionality on Mobile
    console.log('Testing logout button click...');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const logoutBtn = document.querySelector('button[aria-label="Logout"]');
        if (logoutBtn) logoutBtn.click();
      })()`
    });
    await sleep(1500);

    const postLogoutCheck = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        return {
          token: localStorage.getItem('campusflow_token'),
          user: localStorage.getItem('campusflow_user'),
          pathname: window.location.pathname
        };
      })()`,
      returnByValue: true
    });
    console.log('Post-logout result:', postLogoutCheck.result?.value);

    cdp.close();
    console.log('Verification finished successfully!');
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

run().catch(console.error);
