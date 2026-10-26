import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function main() {
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

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });

    await cdp.send('Page.navigate', { url: 'http://localhost:5173/hod' });
    await new Promise(r => setTimeout(r, 1500));

    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const viewDetailsBtn = btns.find(b => b.textContent.includes('View details'));
          if (viewDetailsBtn) viewDetailsBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 2000));

    const styles = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('.modal-container button'));
          return btns.map(b => {
            const cs = window.getComputedStyle(b);
            return {
              text: b.textContent.trim(),
              className: b.className,
              bg: cs.backgroundColor,
              color: cs.color,
              display: cs.display,
              width: cs.width,
              height: cs.height,
              visible: b.offsetWidth > 0 && b.offsetHeight > 0
            };
          });
        })()
      `,
      returnByValue: true
    });
    console.log('Button styles:', JSON.stringify(styles.result.value, null, 2));
  } finally {
    chrome.kill();
  }
}

main().catch(console.error);
