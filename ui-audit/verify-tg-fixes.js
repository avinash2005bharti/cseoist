import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'verified_tg_fixes');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setAuth(cdp, authData) {
  const expr = `
    localStorage.setItem('campusflow_token', ${JSON.stringify(authData.token)});
    localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authData.user))});
    localStorage.setItem('campusflow_role', ${JSON.stringify(authData.role)});
  `;
  await cdp.send('Runtime.evaluate', { expression: expr });
}

async function main() {
  const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));
  const tgAuth = authTokens.tg;

  console.log('Capturing verified TG dashboard, review drawer, and ledger modal...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, tgAuth);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 1. Check TG Dashboard Header (No hardcoded 6 badge)
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg` });
    await sleep(2500);
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, '1-tg-dashboard-header.png'), { width: 1440, height: 900 });
    console.log('Saved 1-tg-dashboard-header.png');

    // 2. Open TG Ledger Modal from Dashboard
    const openLedgerExpr = `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('View Records'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `;
    const ledgerOpened = await cdp.send('Runtime.evaluate', { expression: openLedgerExpr, returnByValue: true });
    console.log('Ledger modal opened:', ledgerOpened.result.value);
    await sleep(2500);

    // Also check input computed padding
    const inpInfo = await cdp.send('Runtime.evaluate', {
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
    console.log('LEDGER INPUT COMPUTED STYLE:', inpInfo.result.value);

    // In the ledger, switch to "Show Previous Considerations" so we see the table rows with dates!
    const clickPrevExpr = `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const prevBtn = btns.find(b => b.textContent.includes('Show Previous Considerations'));
        if (prevBtn) {
          prevBtn.click();
          return true;
        }
        return false;
      })()
    `;
    await cdp.send('Runtime.evaluate', { expression: clickPrevExpr });
    await sleep(2000);

    await captureScreenshot(cdp, path.join(OUTPUT_DIR, '2-tg-ledger-modal-with-records.png'), { width: 1440, height: 900 });
    console.log('Saved 2-tg-ledger-modal-with-records.png');

    // Close ledger modal
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const closeBtn = document.querySelector('button[aria-label="Close modal"]') || document.querySelector('.ledger-modal-overlay button');
          if (closeBtn) closeBtn.click();
        })()
      `
    });
    await sleep(1000);

    // 3. Go to /tg/requests, switch to "Recommended by TG" or "All Applications", open Details drawer!
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg/requests` });
    await sleep(2500);

    const switchTabAndOpenDetailsExpr = `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const recommendedTab = buttons.find(b => b.textContent.trim().includes('Recommended by TG')) || buttons.find(b => b.textContent.trim().includes('All Applications'));
        if (recommendedTab) {
          recommendedTab.click();
          return "switched tab";
        }
        return "tab not found";
      })()
    `;
    const tabRes = await cdp.send('Runtime.evaluate', { expression: switchTabAndOpenDetailsExpr, returnByValue: true });
    console.log('Tab switch result:', tabRes.result.value);
    await sleep(1500);

    const clickDetailsExpr = `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const detailsBtn = buttons.find(b => b.textContent.includes('Details'));
        if (detailsBtn) {
          detailsBtn.click();
          return true;
        }
        return false;
      })()
    `;
    const detailsRes = await cdp.send('Runtime.evaluate', { expression: clickDetailsExpr, returnByValue: true });
    console.log('Details button clicked:', detailsRes.result.value);
    await sleep(1500);

    await captureScreenshot(cdp, path.join(OUTPUT_DIR, '3-tg-requests-details-drawer.png'), { width: 1440, height: 900 });
    console.log('Saved 3-tg-requests-details-drawer.png');

    console.log('All verification captures completed successfully!');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main();
