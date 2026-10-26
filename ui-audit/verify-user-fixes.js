import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const tokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit/auth-tokens.json'), 'utf8'));

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chromeProc = await launchChrome();
  const { cdp } = await createPage('http://localhost:5173/login');
  await sleep(1000);

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const hodData = tokens.hod;
  await cdp.send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('cf_access_token', ${JSON.stringify(hodData.token)});
      localStorage.setItem('campusflow_token', ${JSON.stringify(hodData.token)});
      localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(hodData.user))});
      localStorage.setItem('campusflow_role', 'hod');
    `,
  });

  // 1. Navigate to HOD Dashboard
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/hod' });
  await sleep(2000);

  // Take screenshot of HOD Dashboard hero with highlighted button & notice board
  let ss = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve('ui-audit/hod-dashboard-verified.png'), Buffer.from(ss.data, 'base64'));
  console.log('Captured hod-dashboard-verified.png');

  // Check buttons
  const buttonsCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
      const hasClearances = btns.some(t => t.includes('Attendance Clearances'));
      const hasSendNotice = btns.some(t => t.includes('Send Notice'));
      const hasNoticeBoard = document.body.innerText.includes('Notice Board');
      return { hasClearances, hasSendNotice, hasNoticeBoard, btns: btns.slice(0, 10) };
    })()`,
    returnByValue: true,
  });
  console.log('Dashboard Buttons check:', buttonsCheck.result.value);

  // 2. Click Notification Bell
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('button[aria-label="View notifications"]')?.click()`,
  });
  await sleep(1000);
  ss = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve('ui-audit/hod-notif-centre.png'), Buffer.from(ss.data, 'base64'));
  console.log('Captured hod-notif-centre.png');

  const notifCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const panel = document.querySelector('.notification-dropdown-panel');
      const text = panel ? panel.innerText : '';
      const hasMarkAllRead = text.includes('Mark all as read') || text.includes('Mark all read');
      return { hasPanel: Boolean(panel), hasMarkAllRead, panelSnippet: text.substring(0, 200) };
    })()`,
    returnByValue: true,
  });
  console.log('Notification Centre check:', notifCheck.result.value);

  // Close notifications
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('.notif-mobile-backdrop')?.click() || document.querySelector('button[aria-label="View notifications"]')?.click()`,
  });
  await sleep(500);

  // 3. Open Attendance Clearances Modal
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Attendance Clearances'));
      if (btn) btn.click();
    })()`,
  });
  await sleep(1500);

  ss = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve('ui-audit/hod-clearances-modal.png'), Buffer.from(ss.data, 'base64'));
  console.log('Captured hod-clearances-modal.png');

  const clearancesCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.querySelector('.modal-container') || document.querySelector('[role="dialog"]') || document.body;
      const selects = Array.from(document.querySelectorAll('select')).map(s => ({
        value: s.value,
        options: Array.from(s.options).map(o => o.text)
      }));
      const text = modal.innerText;
      const hasAssignedScopeBadge = text.includes('Assigned Scope:');
      const hasSemesterSelect = selects.some(s => s.options.some(o => o.includes('All Semesters')));
      const hasSectionSelect = selects.some(s => s.options.some(o => o.includes('All Sections')));
      return { hasSemesterSelect, hasSectionSelect, hasAssignedScopeBadge, selectsCount: selects.length, selects };
    })()`,
    returnByValue: true,
  });
  console.log('Clearances Modal filters check:', clearancesCheck.result.value);

  // Close modal
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const closeBtn = document.querySelector('button[aria-label="Close"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText === '✕' || b.innerText === 'X');
      if (closeBtn) closeBtn.click();
    })()`,
  });
  await sleep(1000);

  // 4. Click TG Recommendation card to navigate to dedicated page
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.hod-action-card, [role="button"]'));
      const tgCard = cards.find(c => c.innerText.includes('TG Recommendation'));
      if (tgCard) tgCard.click();
    })()`,
  });
  await sleep(2000);

  const tgPageCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      return {
        url: window.location.href,
        h1: document.querySelector('h1')?.innerText,
        text: document.body.innerText.substring(0, 500),
        tabs: Array.from(document.querySelectorAll('.hod-tab-btn')).map(t => t.innerText.replace(/\\n/g, ' ')),
        hasClearancesBtn: Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Attendance Clearances'))
      };
    })()`,
    returnByValue: true,
  });
  console.log('TG Page Check:', tgPageCheck.result.value);

  ss = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve('ui-audit/hod-tg-page.png'), Buffer.from(ss.data, 'base64'));
  console.log('Captured hod-tg-page.png');

  try {
    process.kill(-chromeProc.pid);
  } catch (e) {
    try {
      chromeProc.kill();
    } catch (err) {}
  }
}

run().catch(console.error);
