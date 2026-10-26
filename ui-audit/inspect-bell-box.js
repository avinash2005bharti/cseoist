import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function main() {
  const chromeProc = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/tg');
    const authTokens = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json', 'utf8'));
    const expr = `
      localStorage.setItem('campusflow_token', ${JSON.stringify(authTokens.tg.token)});
      localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authTokens.tg.user))});
      localStorage.setItem('campusflow_role', 'tg');
    `;
    await cdp.send('Runtime.evaluate', { expression: expr });
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/tg' });
    await new Promise((r) => setTimeout(r, 2000));
    const res = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[aria-label="View notifications"]');
          if (!btn) return 'Bell button not found';
          const r = btn.getBoundingClientRect();
          const svg = btn.querySelector('svg');
          const svgR = svg ? svg.getBoundingClientRect() : null;
          const badge = btn.querySelector('span');
          const badgeR = badge ? badge.getBoundingClientRect() : null;
          const badgeCs = badge ? window.getComputedStyle(badge) : null;
          // Find matching rules
          const matched = [];
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (rule.selectorText && badge.matches(rule.selectorText)) {
                  matched.push({ sel: rule.selectorText, cssText: rule.cssText });
                }
              }
            } catch(e) {}
          }
          return {
            btn: { x: r.x, y: r.y, w: r.width, h: r.height },
            svg: svgR ? { x: svgR.x, y: svgR.y, w: svgR.width, h: svgR.height } : null,
            badge: badgeR ? { x: badgeR.x, y: badgeR.y, w: badgeR.width, h: badgeR.height } : null,
            badgeStyle: badgeCs ? { position: badgeCs.position, top: badgeCs.top, right: badgeCs.right, left: badgeCs.left, transform: badgeCs.transform } : null,
            matchedRules: matched
          };
        })()
      `,
      returnByValue: true,
    });
    console.log(JSON.stringify(res.result.value, null, 2));

    // Capture clip of header
    const clip = {
      x: 1100,
      y: 0,
      width: 340,
      height: 80,
      scale: 1,
    };
    const ss = await cdp.send('Page.captureScreenshot', { format: 'png', clip });
    fs.writeFileSync('ui-audit/header-crop.png', Buffer.from(ss.data, 'base64'));
    console.log('Saved header-crop.png');
    cdp.close();
  } finally {
    chromeProc.kill();
  }
}

main().catch(console.error);
