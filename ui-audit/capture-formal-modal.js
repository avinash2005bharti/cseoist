import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/student/considerations');
    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).student;

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', 'student');
        window.location.href = 'http://localhost:5173/student/considerations';
      `
    });

    await sleep(3000);

    // Click on "View Sanctioned Certificate" button if available, or trigger it via the page state
    const openRes = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View Sanctioned Certificate') || b.textContent.includes('Sanctioned Certificate'));
        if (btn) {
          btn.click();
          return { found: true, text: btn.textContent };
        }
        return { found: false };
      })()`
    });
    console.log('Open Sanctioned Certificate button:', openRes.result.value);

    // If no approved item currently selected in list, let's find any row with Approved by HOD and click it
    if (!openRes.result.value.found) {
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const approvedBadge = Array.from(document.querySelectorAll('span, td')).find(el => el.textContent.includes('Approved by HOD') || el.textContent.includes('Approved'));
          if (approvedBadge) {
            const row = approvedBadge.closest('tr') || approvedBadge.closest('div');
            if (row) row.click();
          }
        })()`
      });
      await sleep(1000);

      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View Sanctioned Certificate') || b.textContent.includes('Sanctioned Certificate'));
          if (btn) btn.click();
        })()`
      });
      await sleep(1000);
    }

    const sModal = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/formal_sanction_order_verified.png', Buffer.from(sModal.data, 'base64'));
    console.log('Saved ui-audit/formal_sanction_order_verified.png');

  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
