import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/student');
    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).student;

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', 'student');
        window.location.href = 'http://localhost:5173/student';
      `
    });

    await sleep(2500);

    const s1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/live_student_dashboard.png', Buffer.from(s1.data, 'base64'));
    console.log('Saved ui-audit/live_student_dashboard.png');

    // Click "+ Apply" to open modal
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Apply'));
        if (btn) btn.click();
      `
    });
    await sleep(1500);

    const s2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/live_student_modal.png', Buffer.from(s2.data, 'base64'));
    console.log('Saved ui-audit/live_student_modal.png');

  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
