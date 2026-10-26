import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
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

    // Wait until dashboard loads
    let loaded = false;
    for (let i = 0; i < 25; i++) {
      await sleep(500);
      const res = await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const t = document.body.innerText || '';
            return t.includes('Good') || t.includes('HOD Office') || t.includes('Section Overview');
          })()
        `,
        returnByValue: true
      });
      if (res.result.value) {
        loaded = true;
        break;
      }
    }
    console.log('Dashboard loaded:', loaded);

    await sleep(1500);

    // Open Section Overview Modal
    const openRes = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const viewDetailsBtn = btns.find(b => b.textContent.includes('View details'));
          if (!viewDetailsBtn) return { error: 'No view details button found' };
          viewDetailsBtn.click();
          return { success: true };
        })()
      `,
      returnByValue: true
    });
    console.log('Click View details:', openRes.result.value);

    await sleep(2000);

    // Screenshot Section Overview Modal
    const s1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_promote_demote/final_section_overview_1440.png', Buffer.from(s1.data, 'base64'));
    console.log('Saved final_section_overview_1440.png');

    // Click Promote ▶
    const pRes = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('.modal-container button'));
          const pBtn = btns.find(b => b.textContent.trim().startsWith('Promote'));
          if (!pBtn) return { error: 'No promote button found' };
          pBtn.click();
          return { success: true, text: pBtn.textContent.trim() };
        })()
      `,
      returnByValue: true
    });
    console.log('Click Promote:', pRes.result.value);

    await sleep(1000);

    // Screenshot Promote Dialog (MoveSemesterModal)
    const s2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_promote_demote/final_promote_modal_1440.png', Buffer.from(s2.data, 'base64'));
    console.log('Saved final_promote_modal_1440.png');

    // Cancel Promote
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const cancelBtn = btns.find(b => b.textContent.trim() === 'Cancel');
          if (cancelBtn) cancelBtn.click();
        })()
      `
    });
    await sleep(600);

    // Click ◀ Demote
    const dRes = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('.modal-container button'));
          const dBtn = btns.find(b => b.textContent.trim().endsWith('Demote'));
          if (!dBtn) return { error: 'No demote button found' };
          dBtn.click();
          return { success: true, text: dBtn.textContent.trim() };
        })()
      `,
      returnByValue: true
    });
    console.log('Click Demote:', dRes.result.value);

    await sleep(1000);

    // Screenshot Demote Dialog
    const s3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_promote_demote/final_demote_modal_1440.png', Buffer.from(s3.data, 'base64'));
    console.log('Saved final_demote_modal_1440.png');

    // Close Demote and Section Overview Modal
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const cancelBtn = btns.find(b => b.textContent.trim() === 'Cancel');
          if (cancelBtn) cancelBtn.click();
          const closeBtn = document.querySelector('button[aria-label=\"Close\"]');
          if (closeBtn) closeBtn.click();
        })()
      `
    });
    await sleep(800);

    // Open ClassesCurriculumModal ("Promote / Demote" on dashboard)
    const cRes = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const pBtn = btns.find(b => b.textContent.trim() === 'Promote / Demote');
          if (!pBtn) return { error: 'No Promote / Demote button found' };
          pBtn.click();
          return { success: true };
        })()
      `,
      returnByValue: true
    });
    console.log('Click Promote / Demote:', cRes.result.value);

    await sleep(1500);

    // Screenshot ClassesCurriculumModal (Screen 25.png reference)
    const s4 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_promote_demote/final_classes_curriculum_1440.png', Buffer.from(s4.data, 'base64'));
    console.log('Saved final_classes_curriculum_1440.png');

  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
