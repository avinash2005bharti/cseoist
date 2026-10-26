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

    // Click "View Order"
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View Order'));
        if (btn) btn.click();
      })()`
    });
    await sleep(1500);

    // 1. Capture on-screen modal
    const sOnscreen = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/official_modal_onscreen.png', Buffer.from(sOnscreen.data, 'base64'));
    console.log('Saved ui-audit/official_modal_onscreen.png');

    // 2. Emulate media print and check layout
    await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
    await sleep(1000);

    const sPrintMedia = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/official_letter_print_emulated.png', Buffer.from(sPrintMedia.data, 'base64'));
    console.log('Saved ui-audit/official_letter_print_emulated.png');

    // 3. PrintToPDF
    const pdfResult = await cdp.send('Page.printToPDF', {
      paperWidth: 8.27, // A4 in inches
      paperHeight: 11.69,
      marginTop: 0.4,
      marginBottom: 0.4,
      marginLeft: 0.5,
      marginRight: 0.5,
      printBackground: true,
      preferCSSPageSize: true
    });
    fs.writeFileSync('ui-audit/official_sanction_order.pdf', Buffer.from(pdfResult.data, 'base64'));
    console.log('Saved ui-audit/official_sanction_order.pdf');

  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
