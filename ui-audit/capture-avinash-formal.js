import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/login');

    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhZGU0OWM2ZTg2NzZkMWEyZmI1NTc4ZCIsInJvbGUiOiJTVFVERU5UIiwiaWF0IjoxNzkzMDM5MjYwLCJleHAiOjE3OTM2NDQwNjB9.CNVXmdm8s_B0VFcXKuQpImxOA0qd91Q0oaMZHzxFXfk';
    const user = {
      id: '6ade49c6e8676d1a2fb5578d',
      name: 'Avinash Bharti',
      email: 'avinashbharti3007@gmail.com',
      role: 'STUDENT',
      mustChangePassword: false,
      isTG: false
    };

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
        localStorage.setItem('campusflow_token', ${JSON.stringify(token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(user))});
        localStorage.setItem('campusflow_role', 'student');
        window.location.href = 'http://localhost:5173/student';
      `
    });

    await sleep(3500);

    // Click "View Order" directly on the dashboard card
    const viewOrderClick = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent.includes('View Order')
        );
        if (btn) {
          btn.click();
          return { found: true, text: btn.textContent };
        }
        return { found: false };
      })()`
    });
    console.log('View Order Click:', viewOrderClick.result.value);

    await sleep(1500);

    // Scroll container to bottom to view signatures
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.querySelector('#formal-sanction-printable');
        if (modal) modal.scrollTop = modal.scrollHeight;
      })()`
    });
    await sleep(800);

    const sModal = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/formal_sanction_order_scrolled.png', Buffer.from(sModal.data, 'base64'));
    console.log('Saved ui-audit/formal_sanction_order_scrolled.png');

  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
