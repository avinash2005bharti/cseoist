import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'verification_student');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setAuth(cdp, authData) {
  const expr = `
    localStorage.clear();
    localStorage.setItem('campusflow_token', ${JSON.stringify(authData.token)});
    localStorage.setItem('cf_access_token', ${JSON.stringify(authData.token)});
    localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authData.user))});
    localStorage.setItem('campusflow_role', 'student');
  `;
  await cdp.send('Runtime.evaluate', { expression: expr });
}

async function run() {
  const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));
  const studentAuth = authTokens.student;

  console.log('Testing Student Dashboard Consideration Window dynamic label...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, studentAuth);

    // Navigate to Student Dashboard
    await cdp.send('Page.navigate', { url: `${APP_BASE}/student` });
    await sleep(2500);

    // Capture screenshot of student dashboard
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'student-dashboard-current.png'), { width: 1440, height: 900 });

    // Inspect the quick link label on the page
    const labelResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const considerationCard = Array.from(document.querySelectorAll('div[role="button"]'))
          .find(el => el.textContent.includes('Apply for Consideration'));
        if (!considerationCard) return { error: 'Card not found' };
        
        return {
          cardText: considerationCard.innerText.replace(/\\n+/g, ' | ')
        };
      })()`,
      returnByValue: true
    });

    console.log('Student consideration card label:', labelResult.result?.value);

    // Also check on mobile (375x812)
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'student-dashboard-mobile.png'), { width: 375, height: 812 });

    const mobileLabelResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const considerationCard = Array.from(document.querySelectorAll('div[role="button"]'))
          .find(el => el.textContent.includes('Apply for Consideration'));
        if (!considerationCard) return { error: 'Card not found' };
        
        return {
          cardText: considerationCard.innerText.replace(/\\n+/g, ' | ')
        };
      })()`,
      returnByValue: true
    });

    console.log('Mobile student consideration card label:', mobileLabelResult.result?.value);

    cdp.close();
    console.log('Student verification completed successfully!');
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

run().catch(console.error);
