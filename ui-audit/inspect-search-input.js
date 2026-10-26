import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function main() {
  const chromeProc = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/login');
    const authTokens = JSON.parse(fs.readFileSync('./ui-audit/auth-tokens.json', 'utf8'));
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(authTokens.hod.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authTokens.hod.user))});
        localStorage.setItem('campusflow_role', ${JSON.stringify(authTokens.hod.role)});
      `
    });
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/hod?open_ledger=true' });
    await new Promise(r => setTimeout(r, 3000));
    const res = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const inp = document.querySelector('input[placeholder*="Search student"]');
          if (!inp) return "no input";
          const cs = window.getComputedStyle(inp);
          return {
            paddingLeft: cs.paddingLeft,
            paddingRight: cs.paddingRight,
            className: inp.className
          };
        })()
      `,
      returnByValue: true
    });
    console.log('INPUT COMPUTED STYLE:', JSON.stringify(res.result.value, null, 2));
  } finally {
    chromeProc.kill();
  }
}

main();
