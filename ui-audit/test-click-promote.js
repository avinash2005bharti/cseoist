import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function main() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/hod');
    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).hod;

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', ${JSON.stringify(auth.role)});
      `
    });

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send('Page.navigate', { url: 'http://localhost:5173/hod' });
    await new Promise(r => setTimeout(r, 2000));

    // Open Section Overview Modal
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const viewDetailsBtn = btns.find(b => b.textContent.includes('View details'));
          if (viewDetailsBtn) viewDetailsBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Click Promote
    const clickRes = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('.modal-container button'));
          const promoteBtn = btns.find(b => b.textContent.includes('Promote'));
          if (!promoteBtn) return { error: 'No promote button found' };
          promoteBtn.click();
          return { success: true, text: promoteBtn.textContent, disabled: promoteBtn.disabled };
        })()
      `,
      returnByValue: true
    });
    console.log('Click result:', clickRes.result.value);

    await new Promise(r => setTimeout(r, 1000));

    // Check if MoveSemesterModal is open
    const checkModal = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const h3 = Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim());
          const hasModal = document.body.textContent.includes('Promote Section to Next Semester');
          return { h3, hasModal };
        })()
      `,
      returnByValue: true
    });
    console.log('Modal status:', checkModal.result.value);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/test_promote_modal.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved test_promote_modal.png');
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
