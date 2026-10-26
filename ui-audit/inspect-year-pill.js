import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function check() {
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
    await new Promise(r => setTimeout(r, 1500));

    const res = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.hod-pill-indigo');
          const cs = window.getComputedStyle(btn);
          return {
            bg: cs.backgroundColor,
            color: cs.color,
            border: cs.border,
            boxShadow: cs.boxShadow,
            height: cs.height,
            inlineStyle: btn.getAttribute('style')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Button details:', res.result.value);
  } finally {
    chrome.kill();
  }
}
check().catch(console.error);
