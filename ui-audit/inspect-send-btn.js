import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function run() {
  const tokens = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json', 'utf8'));
  const proc = await launchChrome();
  const { cdp } = await createPage('http://localhost:5173/login');
  await new Promise(r => setTimeout(r, 1000));
  const hodData = tokens.hod;
  await cdp.send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('campusflow_token', ${JSON.stringify(hodData.token)});
      localStorage.setItem('cf_access_token', ${JSON.stringify(hodData.token)});
      localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(hodData.user))});
      localStorage.setItem('campusflow_role', 'hod');
    `
  });
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/hod' });
  await new Promise(r => setTimeout(r, 2000));

  const res = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sendBtn = btns.find(b => b.innerText.includes('Send Notice'));
      if (!sendBtn) return 'NOT FOUND';
      
      // Find rules affecting this button
      const rules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && sendBtn.matches(rule.selectorText)) {
              if (rule.style.background || rule.style.backgroundColor || rule.style.color) {
                rules.push({ selector: rule.selectorText, bg: rule.style.backgroundColor || rule.style.background, color: rule.style.color });
              }
            }
          }
        } catch (e) {}
      }
      return { rules };
    })()`,
    returnByValue: true
  });
  console.log('RULES:', JSON.stringify(res.result.value, null, 2));

  try {
    process.kill(-proc.pid);
  } catch (e) {
    try { proc.kill(); } catch (err) {}
  }
}
run();
