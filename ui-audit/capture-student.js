import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'current_student');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const tokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit/auth-tokens.json'), 'utf8'));
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await sleep(1500);

    // Set student auth
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
        localStorage.setItem('campusflow_token', '${tokens.student.token}');
        localStorage.setItem('cf_access_token', '${tokens.student.token}');
        localStorage.setItem('campusflow_role', 'student');
        localStorage.setItem('campusflow_user', JSON.stringify(${JSON.stringify(tokens.student.user)}));
      `
    });

    await cdp.send('Page.navigate', { url: `${APP_BASE}/student` });
    await sleep(2500);

    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'student-desktop-after.png'), { width: 1440, height: 900 });
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'student-mobile-after.png'), { width: 375, height: 812 });

    cdp.close();
    console.log('Capture completed!');
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch(console.error);
