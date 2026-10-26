import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function main() {
  const chromeProc = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/login');
    const authTokens = JSON.parse(fs.readFileSync('./ui-audit/auth-tokens.json', 'utf8'));
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(authTokens.tg.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authTokens.tg.user))});
        localStorage.setItem('campusflow_role', ${JSON.stringify(authTokens.tg.role)});
      `
    });
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/tg/requests' });
    await new Promise(r => setTimeout(r, 2500));
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const b = btns.find(x => x.textContent.includes('Recommended by TG'));
          if (b) b.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const b = btns.find(x => x.textContent.includes('Details'));
          if (b) b.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    const check = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const asides = Array.from(document.querySelectorAll('aside'));
          const rightDrawer = asides.find(a => !a.className.includes('sidebar-container'));
          
          function getStackingContextInfo(el) {
            const parents = [];
            let cur = el;
            while (cur && cur !== document.body) {
              const cs = window.getComputedStyle(cur);
              parents.push({
                tag: cur.tagName,
                className: cur.className,
                position: cs.position,
                zIndex: cs.zIndex,
                transform: cs.transform,
                opacity: cs.opacity,
                filter: cs.filter
              });
              cur = cur.parentElement;
            }
            return parents;
          }

          return {
            rightDrawer: rightDrawer ? getStackingContextInfo(rightDrawer) : "NO RIGHT DRAWER FOUND"
          };
        })()
      `,
      returnByValue: true
    });
    console.log('RIGHT DRAWER STACKING CONTEXT:', JSON.stringify(check.result.value, null, 2));
  } finally {
    chromeProc.kill();
  }
}

main();
