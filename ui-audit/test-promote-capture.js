import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function test() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/login');
    await sleep(1000);

    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).hod;

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('cf_access_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', 'hod');
      `
    });

    await cdp.send('Page.navigate', { url: 'http://localhost:5173/hod' });
    
    // Wait until loaded
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const res = await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const text = document.body.innerText || '';
            const isAuth = text.includes('Authenticating Academic Session');
            const hasGood = text.includes('Good Morning') || text.includes('Good Afternoon') || text.includes('Good Evening');
            return !isAuth && hasGood;
          })()
        `,
        returnByValue: true
      });
      if (res.result.value) {
        console.log('HOD Dashboard loaded successfully!');
        break;
      }
    }

    await sleep(1000);

    // Now open Section Overview
    const openRes = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const viewDetailsBtn = btns.find(b => b.textContent.includes('View details'));
          if (!viewDetailsBtn) return { error: 'No view details button found', buttons: btns.map(b => b.textContent.trim()) };
          viewDetailsBtn.click();
          return { clicked: true };
        })()
      `,
      returnByValue: true
    });
    console.log('Open result:', openRes.result.value);

    // Wait for SectionOverview modal
    await sleep(2000);

    // Capture SectionOverview screenshot
    const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_promote_demote/test_section_overview.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved test_section_overview.png');

    // Click Promote ▶
    const promoteRes = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('.modal-container button'));
          const pBtn = btns.find(b => b.textContent.trim().startsWith('Promote'));
          if (!pBtn) return { error: 'No promote button found', buttons: btns.map(b => b.textContent.trim()) };
          pBtn.click();
          return { clickedPromote: true, text: pBtn.textContent.trim() };
        })()
      `,
      returnByValue: true
    });
    console.log('Promote click result:', promoteRes.result.value);

    await sleep(1000);

    // Capture Promote dialog
    const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_promote_demote/test_promote_dialog.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved test_promote_dialog.png');

    // Click Cancel on Promote dialog
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const cancelBtn = btns.find(b => b.textContent.trim() === 'Cancel');
          if (cancelBtn) cancelBtn.click();
        })()
      `
    });
    await sleep(500);

    // Click ◀ Demote
    const demoteRes = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('.modal-container button'));
          const dBtn = btns.find(b => b.textContent.trim().endsWith('Demote'));
          if (!dBtn) return { error: 'No demote button found', buttons: btns.map(b => b.textContent.trim()) };
          dBtn.click();
          return { clickedDemote: true, text: dBtn.textContent.trim() };
        })()
      `,
      returnByValue: true
    });
    console.log('Demote click result:', demoteRes.result.value);

    await sleep(1000);

    // Capture Demote dialog
    const shot3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_promote_demote/test_demote_dialog.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved test_demote_dialog.png');

  } finally {
    chrome.kill();
  }
}

test().catch(console.error);
