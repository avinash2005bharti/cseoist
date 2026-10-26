import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function test() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/login');
    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).hod;

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', 'hod');
      `
    });

    await cdp.send('Page.navigate', { url: 'http://localhost:5173/hod' });
    await new Promise(r => setTimeout(r, 4000));

    const check = await cdp.send('Runtime.evaluate', {
      expression: `
        (async () => {
          const text = document.body.innerText;
          const url = window.location.href;
          const token = localStorage.getItem('campusflow_token');
          let apiTest = 'not run';
          try {
            const res = await fetch('/api/v1/auth/me', {
              headers: { Authorization: 'Bearer ' + token }
            });
            apiTest = { status: res.status, data: await res.json() };
          } catch (e) {
            apiTest = { error: e.message };
          }
          return { text: text.substring(0, 300), url, hasToken: Boolean(token), apiTest };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Browser State:', JSON.stringify(check.result.value, null, 2));

  } finally {
    chrome.kill();
  }
}

test().catch(console.error);
