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

async function capture() {
  const outDir = 'ui-audit/current_section_overview';
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
      await new Promise(r => setTimeout(r, 1500));

      // Open Section Overview Modal
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const viewDetailsBtn = btns.find(b => b.textContent.includes('View details'));
            if (viewDetailsBtn) {
              viewDetailsBtn.click();
              return 'clicked_view_details';
            }
            return 'not_found';
          })()
        `
      });
      await new Promise(r => setTimeout(r, 1200));

      // Capture SectionOverviewModal
      const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `section_overview_${vp.name}.png`), Buffer.from(shot1.data, 'base64'));
      console.log(`Captured SectionOverviewModal at ${vp.name}`);

      // Now click "Promote ▶" button inside SectionOverviewModal
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const promoteBtn = btns.find(b => b.textContent.includes('Promote'));
            if (promoteBtn) {
              promoteBtn.click();
              return 'clicked_promote';
            }
            return 'not_found';
          })()
        `
      });
      await new Promise(r => setTimeout(r, 800));

      // Capture Promote MoveSemesterModal
      const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `move_semester_promote_${vp.name}.png`), Buffer.from(shot2.data, 'base64'));
      console.log(`Captured MoveSemesterModal Promote at ${vp.name}`);

      // Close MoveSemesterModal (click Cancel)
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

      // Now click "◀ Demote" button inside SectionOverviewModal
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const demoteBtn = btns.find(b => b.textContent.includes('Demote'));
            if (demoteBtn) {
              demoteBtn.click();
              return 'clicked_demote';
            }
            return 'not_found';
          })()
        `
      });
      await new Promise(r => setTimeout(r, 800));

      // Capture Demote MoveSemesterModal
      const shot3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `move_semester_demote_${vp.name}.png`), Buffer.from(shot3.data, 'base64'));
      console.log(`Captured MoveSemesterModal Demote at ${vp.name}`);

      // Close MoveSemesterModal & SectionOverviewModal
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const cancelBtn = btns.find(b => b.textContent.trim() === 'Cancel');
            if (cancelBtn) cancelBtn.click();
            const closeBtns = Array.from(document.querySelectorAll('button[aria-label=\"Close\"], .modal-container button'));
            const doneBtn = btns.find(b => b.textContent.trim() === 'Done');
            if (doneBtn) doneBtn.click();
          })()
        `
      });
      await new Promise(r => setTimeout(r, 500));

      // Also open ClassesCurriculumModal ("Promote / Demote" button on dashboard)
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const pBtn = btns.find(b => b.textContent.includes('Promote / Demote'));
            if (pBtn) pBtn.click();
          })()
        `
      });
      await new Promise(r => setTimeout(r, 1200));

      // Capture ClassesCurriculumModal
      const shot4 = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `classes_curriculum_${vp.name}.png`), Buffer.from(shot4.data, 'base64'));
      console.log(`Captured ClassesCurriculumModal at ${vp.name}`);
    }
  } finally {
    chrome.kill();
  }
}

capture().catch(console.error);
