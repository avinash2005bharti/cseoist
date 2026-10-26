import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'modal_forms_verified');

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
  const studentAuth = authTokens.studentAvinash || authTokens.student;

  console.log('Capturing verified modal forms...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, studentAuth);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Emulation.setVisibleSize', { width: 1440, height: 900 });

    // 1. Student Dashboard (desktop) showing the embedded Request Consideration Card
    await cdp.send('Page.navigate', { url: `${APP_BASE}/student` });
    await sleep(2500);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'dashboard-embedded-form.png'), { width: 1440, height: 900 });
    console.log('Captured dashboard-embedded-form.png');

    // Scroll window down to see bottom of embedded consideration card
    await cdp.send('Runtime.evaluate', { expression: `window.scrollBy(0, 350);` });
    await sleep(800);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'dashboard-embedded-form-bottom.png'), { width: 1440, height: 900 });
    console.log('Captured dashboard-embedded-form-bottom.png');

    // 2. Open Request Consideration Modal
    await cdp.send('Runtime.evaluate', {
      expression: `
        // Click the first quick action card
        const cards = Array.from(document.querySelectorAll('div[role="button"]'));
        const considerCard = cards.find(c => c.textContent.includes('Apply for Consideration'));
        if (considerCard) considerCard.click();
      `
    });
    await sleep(1500);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'modal-request-consideration-top.png'), { width: 1440, height: 900 });
    console.log('Captured modal-request-consideration-top.png');

    // Scroll consideration modal to bottom to show submit button and dropzone
    await cdp.send('Runtime.evaluate', {
      expression: `
        const modalContainer = document.querySelector('.modal-container');
        if (modalContainer) {
          modalContainer.scrollTop = modalContainer.scrollHeight;
        }
      `
    });
    await sleep(1000);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'modal-request-consideration-bottom.png'), { width: 1440, height: 900 });
    console.log('Captured modal-request-consideration-bottom.png');

    // Close consideration modal and open Apply Leave Modal
    await cdp.send('Page.navigate', { url: `${APP_BASE}/student` });
    await sleep(2000);

    const leaveClicked = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('div[role="button"]'));
          const leaveCard = cards.find(c => c.textContent.includes('Apply for Leave'));
          if (leaveCard) {
            leaveCard.click();
            return true;
          }
          return false;
        })()
      `,
      returnByValue: true
    });
    console.log('Leave card clicked result:', leaveClicked.result?.value);
    await sleep(1500);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'modal-apply-leave.png'), { width: 1440, height: 900 });
    console.log('Captured modal-apply-leave.png');

  } catch (err) {
    console.error('Error during modal verification:', err);
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch(console.error);
