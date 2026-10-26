import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function main() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/student');
    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).studentAvinash;
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', ${JSON.stringify(auth.role)});
      `
    });
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/student' });
    await new Promise(r => setTimeout(r, 2000));
    await cdp.send('Runtime.evaluate', {
      expression: `
        const card = Array.from(document.querySelectorAll('div[role="button"]')).find(c => c.textContent.includes('Apply for Consideration'));
        if (card) card.click();
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    const data = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const container = document.querySelector('.modal-container');
          if (!container) return { error: 'No container' };
          const submit = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Submit'));
          const cRect = container.getBoundingClientRect();
          const sRect = submit ? submit.getBoundingClientRect() : null;
          return {
            containerHeight: container.clientHeight,
            containerScrollHeight: container.scrollHeight,
            containerScrollTop: container.scrollTop,
            cRect: { top: cRect.top, bottom: cRect.bottom, right: cRect.right, width: cRect.width, height: cRect.height },
            sRect: sRect ? { top: sRect.top, bottom: sRect.bottom, right: sRect.right, width: sRect.width, height: sRect.height } : null,
            diffBottom: sRect ? cRect.bottom - sRect.bottom : null,
            diffRight: sRect ? cRect.right - sRect.right : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log(JSON.stringify(data.result.value, null, 2));
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
