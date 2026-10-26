import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function main() {
  const chromeProc = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/tg/requests');
    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json', 'utf8')).tg;
    const expr = `
      localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
      localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
      localStorage.setItem('campusflow_role', 'tg');
    `;
    await cdp.send('Runtime.evaluate', { expression: expr });
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/tg/requests' });
    await new Promise((r) => setTimeout(r, 3000));
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('.review-action-btn');
        if (btn) { btn.click(); return 'clicked'; }
        return 'not found';
      })()`,
      returnByValue: true
    });
    await new Promise((r) => setTimeout(r, 1500));

    const res = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const aside = document.querySelector('aside.slide-in-right');
        if (!aside) return 'aside not found';
        const children = Array.from(aside.children).map(c => ({
          tag: c.tagName,
          classes: c.className,
          box: { x: c.getBoundingClientRect().x, y: c.getBoundingClientRect().y, w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height },
          padding: window.getComputedStyle(c).padding,
          margin: window.getComputedStyle(c).margin
        }));
        const inner = aside.querySelector('.overflow-y-auto');
        const innerChildren = inner ? Array.from(inner.children).map(c => ({
          classes: c.className,
          box: { x: c.getBoundingClientRect().x, y: c.getBoundingClientRect().y, w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height },
          padding: window.getComputedStyle(c).padding,
          margin: window.getComputedStyle(c).margin
        })) : [];
        return {
          asideBox: { x: aside.getBoundingClientRect().x, y: aside.getBoundingClientRect().y, w: aside.getBoundingClientRect().width, h: aside.getBoundingClientRect().height },
          children,
          innerChildren
        };
      })()`,
      returnByValue: true,
    });
    console.log(JSON.stringify(res.result.value, null, 2));
    cdp.close();
  } finally {
    chromeProc.kill();
  }
}

main().catch(console.error);
