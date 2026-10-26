import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
];

async function main() {
  const outDir = 'ui-audit/verified_promote_demote';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

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

    for (const vp of VIEWPORTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768,
      });

      await cdp.send('Page.navigate', { url: 'http://localhost:5173/hod' });
      await new Promise(r => setTimeout(r, 2000));

      // 1. Open Section Overview Modal
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const viewDetailsBtn = btns.find(b => b.textContent.includes('View details'));
            if (viewDetailsBtn) viewDetailsBtn.click();
          })()
        `
      });
      // Wait for data to load
      await new Promise(r => setTimeout(r, 2200));

      // Select CSE-B card if not selected
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const secBtns = Array.from(document.querySelectorAll('.modal-container button'));
            const cseB = secBtns.find(b => b.textContent.includes('CSE-B'));
            if (cseB) cseB.click();
          })()
        `
      });
      await new Promise(r => setTimeout(r, 600));

      // Screenshot 1: Section Overview Modal
      const s1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `section_overview_${vp.name}.png`), Buffer.from(s1.data, 'base64'));
      console.log(`Saved section_overview_${vp.name}.png`);

      // 2. Click "Promote ▶" button
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('.modal-container button'));
            const pBtn = btns.find(b => b.textContent.trim().startsWith('Promote'));
            if (pBtn) pBtn.click();
          })()
        `
      });
      await new Promise(r => setTimeout(r, 700));

      // Screenshot 2: Move Semester Modal (Promote)
      const s2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `promote_modal_${vp.name}.png`), Buffer.from(s2.data, 'base64'));
      console.log(`Saved promote_modal_${vp.name}.png`);

      // Close MoveSemesterModal (Cancel)
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const cancelBtn = btns.find(b => b.textContent.trim() === 'Cancel');
            if (cancelBtn) cancelBtn.click();
          })()
        `
      });
      await new Promise(r => setTimeout(r, 500));

      // 3. Click "◀ Demote" button
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('.modal-container button'));
            const dBtn = btns.find(b => b.textContent.trim().endsWith('Demote'));
            if (dBtn) dBtn.click();
          })()
        `
      });
      await new Promise(r => setTimeout(r, 700));

      // Screenshot 3: Move Semester Modal (Demote)
      const s3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `demote_modal_${vp.name}.png`), Buffer.from(s3.data, 'base64'));
      console.log(`Saved demote_modal_${vp.name}.png`);

      // Close MoveSemesterModal (Cancel) and SectionOverviewModal (Close)
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
      await new Promise(r => setTimeout(r, 600));

      // 4. Open ClassesCurriculumModal ("Promote / Demote" on dashboard)
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const pBtn = btns.find(b => b.textContent.trim() === 'Promote / Demote');
            if (pBtn) pBtn.click();
          })()
        `
      });
      await new Promise(r => setTimeout(r, 1200));

      // Screenshot 4: ClassesCurriculumModal
      const s4 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `classes_curriculum_${vp.name}.png`), Buffer.from(s4.data, 'base64'));
      console.log(`Saved classes_curriculum_${vp.name}.png`);
    }
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
