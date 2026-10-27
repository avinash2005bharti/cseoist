import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));
  const hodAuth = authTokens.hod;

  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage('http://localhost:5173/login');

    // Authenticate
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(hodAuth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(hodAuth.user))});
        localStorage.setItem('campusflow_role', ${JSON.stringify(hodAuth.role)});
      `
    });

    await cdp.send('Page.navigate', { url: 'http://localhost:5173/hod/tg-recommendations' });
    await sleep(2500);

    // Trigger two toasts: one green (success/info) and one red (warning/error)
    const toastResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        // Find ERPContext or trigger toast
        const reactRoot = document.querySelector('#root');
        // Let's trigger window event or socket or dispatch custom event
        return { ok: true };
      })()`,
      returnByValue: true
    });

    // Let's check what styles match 'button[aria-label="Close notification"]'
    const cssRules = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        // Create dummy elements to see matching CSS rules
        const greenToast = document.createElement('div');
        greenToast.className = 'pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 transform translate-y-0 opacity-100 bg-[#F0FDF4] border-emerald-400 text-emerald-950 border-l-[6px] border-l-emerald-600';
        
        const greenBtn = document.createElement('button');
        greenBtn.className = 'toast-close-btn shrink-0';
        greenBtn.setAttribute('aria-label', 'Close notification');
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'lucide lucide-x');
        greenBtn.appendChild(svg);
        greenToast.appendChild(greenBtn);
        document.body.appendChild(greenToast);

        const compBtn = window.getComputedStyle(greenBtn);
        const compSvg = window.getComputedStyle(svg);

        // Find which CSS rules apply to greenBtn
        const matchedRules = [];
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules || []) {
              if (rule.selectorText && greenBtn.matches(rule.selectorText)) {
                matchedRules.push({
                  selector: rule.selectorText,
                  cssText: rule.cssText,
                  href: sheet.href || 'inline'
                });
              }
            }
          } catch (e) {}
        }

        const res = {
          btnBg: compBtn.backgroundColor,
          btnColor: compBtn.color,
          svgColor: compSvg.color,
          svgStroke: compSvg.stroke,
          svgFill: compSvg.fill,
          matchedRules
        };

        document.body.removeChild(greenToast);
        return res;
      })()`,
      returnByValue: true
    });

    console.log('CSS inspection for green toast button:', JSON.stringify(cssRules.result?.value, null, 2));

    cdp.close();
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

run().catch(console.error);
