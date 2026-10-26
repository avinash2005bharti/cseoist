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
          const svg = btn.querySelector('svg');
          const cs = window.getComputedStyle(btn);
          const svgCs = svg ? window.getComputedStyle(svg) : null;
          return {
            btnClasses: btn.className,
            btnDisplay: cs.display,
            btnWidth: cs.width,
            btnHeight: cs.height,
            btnBg: cs.backgroundColor,
            btnBorder: cs.border,
            btnColor: cs.color,
            svgDisplay: svgCs ? svgCs.display : 'none',
            svgWidth: svgCs ? svgCs.width : null,
            svgHeight: svgCs ? svgCs.height : null,
            svgColor: svgCs ? svgCs.color : null,
            svgStroke: svgCs ? svgCs.stroke : null,
            outerHTML: btn.outerHTML
          };
        })()
      `,
      returnByValue: true,
    });
    console.log(JSON.stringify(res.result.value, null, 2));
    cdp.close();
  } finally {
    chromeProc.kill();
  }
}

main().catch(console.error);
