import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

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
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View details'));
        if (btn) btn.click();
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    const res = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const cardsDiv = document.querySelector('.modal-container .flex.items-stretch.gap-3.overflow-x-auto');
          return {
            found: Boolean(cardsDiv),
            outer: cardsDiv ? cardsDiv.outerHTML.slice(0, 400) : 'not found',
            children: cardsDiv ? cardsDiv.children.length : 0,
            rect: cardsDiv ? cardsDiv.getBoundingClientRect().toJSON() : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Result:', JSON.stringify(res.result.value, null, 2));
  } finally {
    chrome.kill();
  }
}
test().catch(console.error);
