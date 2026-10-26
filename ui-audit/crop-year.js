import fs from 'node:fs';
import { launchChrome, createPage } from './cdp.js';

async function crop() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173');
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

    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Promote / Demote');
        if (btn) btn.click();
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    const clip = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector('.modal-container');
          const rect = el.getBoundingClientRect();
          return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            scale: 1
          };
        })()
      `,
      returnByValue: true
    });

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: clip.result.value });
    fs.writeFileSync('ui-audit/classes_modal_clipped.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved classes_modal_clipped.png');
  } finally {
    chrome.kill();
  }
}
crop().catch(console.error);
