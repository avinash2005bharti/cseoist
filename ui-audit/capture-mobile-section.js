import fs from 'node:fs';
import { launchChrome, createPage } from './cdp.js';

async function test() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).hod;
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', 'hod');
        window.location.href = 'http://localhost:5173/hod';
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    // Open Section Overview
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View details'));
        if (btn) btn.click();
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Select CSE-B and ensure modal is scrolled to top
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('.modal-container button'));
        const bCard = btns.find(b => b.textContent.includes('CSE-B'));
        if (bCard) bCard.click();
        const container = document.querySelector('.modal-container');
        if (container) container.scrollTop = 0;
      `
    });
    await new Promise(r => setTimeout(r, 800));

    const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_promote_demote/final_section_overview_mobile_390.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved final_section_overview_mobile_390.png');

    // Click Promote ▶
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('.modal-container button'));
        const pBtn = btns.find(b => b.textContent.trim().startsWith('Promote'));
        if (pBtn) pBtn.click();
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_promote_demote/final_promote_modal_mobile_390.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved final_promote_modal_mobile_390.png');

    // Click Cancel
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        if (btn) btn.click();
      `
    });
    await new Promise(r => setTimeout(r, 600));

    // Click ◀ Demote
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btns = Array.from(document.querySelectorAll('.modal-container button'));
        const dBtn = btns.find(b => b.textContent.trim().endsWith('Demote'));
        if (dBtn) dBtn.click();
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    const shot3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_promote_demote/final_demote_modal_mobile_390.png', Buffer.from(shot3.data, 'base64'));
    console.log('Saved final_demote_modal_mobile_390.png');

  } finally {
    chrome.kill();
  }
}
test().catch(console.error);
