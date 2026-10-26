import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'verified_tg_fixes');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));
  const tgAuth = authTokens.tg;

  console.log('Testing All Applications tab on /tg/requests...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    const expr = `
      localStorage.setItem('campusflow_token', ${JSON.stringify(tgAuth.token)});
      localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(tgAuth.user))});
      localStorage.setItem('campusflow_role', ${JSON.stringify(tgAuth.role)});
    `;
    await cdp.send('Runtime.evaluate', { expression: expr });

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg/requests` });
    await sleep(2500);

    // 1. Click "All Applications" tab under Attendance Consideration
    const clickAllExpr = `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const allTab = buttons.find(b => b.textContent.trim() === 'All Applications');
        if (allTab) {
          allTab.click();
          return true;
        }
        return false;
      })()
    `;
    const clickedAll = await cdp.send('Runtime.evaluate', { expression: clickAllExpr, returnByValue: true });
    console.log('All Applications tab clicked:', clickedAll.result.value);
    await sleep(2000);

    // Inspect cards in the list
    const cardsInfo = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('.space-y-4 > div'));
          return cards.map(c => ({
            name: c.querySelector('h2')?.textContent,
            status: c.querySelector('span[class*="rounded-lg"]')?.textContent,
            event: c.querySelector('div[class*="tracking-wider"] + div')?.textContent
          }));
        })()
      `,
      returnByValue: true
    });
    console.log('ALL APPLICATIONS CARDS:', JSON.stringify(cardsInfo.result.value, null, 2));

    await captureScreenshot(cdp, path.join(OUTPUT_DIR, '5-tg-all-applications-attendance.png'), { width: 1440, height: 900 });
    console.log('Saved 5-tg-all-applications-attendance.png');

    // 2. Click "Leave Applications" -> "All Applications"
    const clickLeavesExpr = `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const leaveTab = buttons.find(b => b.textContent.trim().startsWith('Leave Applications'));
        if (leaveTab) {
          leaveTab.click();
          return true;
        }
        return false;
      })()
    `;
    await cdp.send('Runtime.evaluate', { expression: clickLeavesExpr });
    await sleep(2000);

    await cdp.send('Runtime.evaluate', { expression: clickAllExpr });
    await sleep(2000);

    const leaveCardsInfo = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('.space-y-4 > div'));
          return cards.map(c => ({
            name: c.querySelector('h2')?.textContent,
            status: c.querySelector('span[class*="rounded-lg"]')?.textContent,
            event: c.querySelector('div[class*="tracking-wider"] + div')?.textContent
          }));
        })()
      `,
      returnByValue: true
    });
    console.log('ALL LEAVE APPLICATIONS CARDS:', JSON.stringify(leaveCardsInfo.result.value, null, 2));

    await captureScreenshot(cdp, path.join(OUTPUT_DIR, '6-tg-all-applications-leaves.png'), { width: 1440, height: 900 });
    console.log('Saved 6-tg-all-applications-leaves.png');

    console.log('Verification completed successfully!');
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main();
