import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900, mobile: false },
  { name: '1280x800', width: 1280, height: 800, mobile: false },
  { name: '1024x768', width: 1024, height: 768, mobile: false },
  { name: '768x1024', width: 768, height: 1024, mobile: false },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '360x800', width: 360, height: 800, mobile: true },
];

async function run() {
  const outDir = 'ui-audit/verified_promote_demote';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173');
    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).hod;

    for (const vp of VIEWPORTS) {
      console.log(`\n=== Testing Viewport: ${vp.name} ===`);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: vp.mobile ? 2 : 1,
        mobile: vp.mobile,
      });

      // Navigate and inject auth
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
      for (let i = 0; i < 20; i++) {
        await sleep(400);
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
      console.log(`[${vp.name}] Dashboard loaded:`, loaded);
      await sleep(1000);

      // 1. Open Section Overview Modal
      const openOverviewRes = await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const viewDetailsBtn = btns.find(b => b.textContent.includes('View details'));
            if (!viewDetailsBtn) return { error: 'No View details button found' };
            viewDetailsBtn.click();
            return { success: true };
          })()
        `,
        returnByValue: true
      });
      console.log(`[${vp.name}] Open Section Overview:`, openOverviewRes.result.value);
      await sleep(1500);

      // Select CSE-B if available
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('.modal-container button'));
            const bBtn = btns.find(b => b.textContent.includes('CSE-B'));
            if (bBtn) bBtn.click();
            const container = document.querySelector('.modal-container');
            if (container) container.scrollTop = 0;
          })()
        `
      });
      await sleep(600);

      // Screenshot 1: Section Overview Modal
      const s1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `section_overview_${vp.name}.png`), Buffer.from(s1.data, 'base64'));
      console.log(`[${vp.name}] Saved section_overview_${vp.name}.png`);

      // 2. Click "Promote ▶" button
      const clickPromoteRes = await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('.modal-container button'));
            const pBtn = btns.find(b => b.textContent.trim().startsWith('Promote'));
            if (!pBtn) return { error: 'No Promote button found in modal' };
            pBtn.click();
            return { success: true, text: pBtn.textContent.trim() };
          })()
        `,
        returnByValue: true
      });
      console.log(`[${vp.name}] Click Promote:`, clickPromoteRes.result.value);
      await sleep(1000);

      // Screenshot 2: Promote Confirmation Modal (MoveSemesterModal)
      const s2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `promote_modal_${vp.name}.png`), Buffer.from(s2.data, 'base64'));
      console.log(`[${vp.name}] Saved promote_modal_${vp.name}.png`);

      // Click "Cancel" on Promote Modal
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

      // 3. Click "◀ Demote" button
      const clickDemoteRes = await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('.modal-container button'));
            const dBtn = btns.find(b => b.textContent.trim().endsWith('Demote'));
            if (!dBtn) return { error: 'No Demote button found in modal' };
            dBtn.click();
            return { success: true, text: dBtn.textContent.trim() };
          })()
        `,
        returnByValue: true
      });
      console.log(`[${vp.name}] Click Demote:`, clickDemoteRes.result.value);
      await sleep(1000);

      // Screenshot 3: Demote Confirmation Modal (MoveSemesterModal)
      const s3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `demote_modal_${vp.name}.png`), Buffer.from(s3.data, 'base64'));
      console.log(`[${vp.name}] Saved demote_modal_${vp.name}.png`);

      // Close Demote modal and Close Section Overview Modal
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const cancelBtn = btns.find(b => b.textContent.trim() === 'Cancel');
            if (cancelBtn) cancelBtn.click();
            const closeBtn = document.querySelector('button[aria-label="Close"]');
            if (closeBtn) closeBtn.click();
          })()
        `
      });
      await sleep(800);

      // 4. Open ClassesCurriculumModal ("Promote / Demote" on dashboard)
      const clickClassesRes = await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const pBtn = btns.find(b => b.textContent.trim() === 'Promote / Demote');
            if (!pBtn) return { error: 'No Promote / Demote button found on dashboard' };
            pBtn.click();
            return { success: true };
          })()
        `,
        returnByValue: true
      });
      console.log(`[${vp.name}] Open ClassesCurriculumModal:`, clickClassesRes.result.value);
      await sleep(1200);

      // Screenshot 4: ClassesCurriculumModal (Screen 25 reference)
      const s4 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `classes_curriculum_${vp.name}.png`), Buffer.from(s4.data, 'base64'));
      console.log(`[${vp.name}] Saved classes_curriculum_${vp.name}.png`);

      // Close ClassesCurriculumModal
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const closeBtn = document.querySelector('button[aria-label="Close"]');
            if (closeBtn) closeBtn.click();
          })()
        `
      });
      await sleep(600);
    }
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
