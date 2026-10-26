import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const tokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit/auth-tokens.json'), 'utf8'));

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function inspectAll() {
  const chromeProc = await launchChrome();
  const { cdp } = await createPage('http://localhost:5173/login');
  await sleep(1500);

  const targets = [
    { name: 'HOD Dashboard', url: 'http://localhost:5173/hod', token: tokens.hod, role: 'hod' },
    { name: 'HOD Considerations', url: 'http://localhost:5173/hod/considerations', token: tokens.hod, role: 'hod' },
    { name: 'TG Dashboard', url: 'http://localhost:5173/tg', token: tokens.tg, role: 'tg' },
    { name: 'TG Requests', url: 'http://localhost:5173/tg/requests', token: tokens.tg, role: 'tg' },
    { name: 'Student Dashboard', url: 'http://localhost:5173/student', token: tokens.student, role: 'student' },
    { name: 'Student Requests', url: 'http://localhost:5173/student/requests', token: tokens.student, role: 'student' }
  ];

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  for (const t of targets) {
    console.log(`\n======================================================`);
    console.log(`>>> NAVIGATING TO ${t.name} (${t.url})`);
    console.log(`======================================================`);

    await cdp.send('Page.navigate', { url: 'http://localhost:5173/login' });
    await sleep(400);

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
        localStorage.setItem('campusflow_token', '${t.token}');
        localStorage.setItem('cf_access_token', '${t.token}');
        localStorage.setItem('campusflow_role', '${t.role}');
      `
    });

    await cdp.send('Page.navigate', { url: t.url });
    await sleep(2500);

    const { result } = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const url = window.location.href;
        const pageTitle = document.querySelector('h1, h2')?.innerText || document.title;
        const buttons = [];
        const selects = [];
        const tabs = [];
        const optionsLikeButtons = [];

        // Find all buttons
        document.querySelectorAll('button, .btn, [role="button"]').forEach(el => {
          const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').substring(0, 45);
          if (!text) return;
          const s = window.getComputedStyle(el);
          buttons.push({
            text,
            tag: el.tagName,
            cls: el.className ? el.className.substring(0, 50) : '',
            bg: s.backgroundColor,
            color: s.color,
            border: s.borderColor
          });
        });

        // Find select and options
        document.querySelectorAll('select, .filter-bar, .action-bar').forEach(el => {
          const s = window.getComputedStyle(el);
          selects.push({
            tag: el.tagName,
            text: (el.innerText || el.value || '').trim().replace(/\\s+/g, ' ').substring(0, 45),
            bg: s.backgroundColor,
            color: s.color,
            border: s.borderColor,
            radius: s.borderRadius
          });
        });

        return { url, pageTitle, buttons, selects };
      })()`,
      returnByValue: true
    });

    const data = result.value || {};
    console.log(`Current URL: ${data.url} | Title: "${data.pageTitle}"`);
    console.log(`Found ${data.buttons.length} buttons and ${data.selects.length} selects/filter areas:`);
    
    // Check buttons with green or red
    const greenRedButtons = data.buttons.filter(b => {
      const g = b.bg.includes('16, 185, 129') || b.bg.includes('5, 150, 105') || b.bg.includes('236, 253, 245') || b.color.includes('16, 185, 129') || b.color.includes('6, 95, 70') || b.color.includes('5, 150, 105');
      const r = b.bg.includes('225, 29, 72') || b.bg.includes('244, 63, 94') || b.bg.includes('255, 241, 242') || b.color.includes('225, 29, 72') || b.color.includes('159, 18, 57') || b.color.includes('244, 63, 94') || b.color.includes('219, 39, 119');
      return g || r;
    });

    if (greenRedButtons.length > 0) {
      console.log(`  [ALERT: Green or Red in Buttons (${greenRedButtons.length})]:`);
      greenRedButtons.forEach(b => console.log(`   * "${b.text}" -> bg: ${b.bg}, color: ${b.color}, border: ${b.border}`));
    } else {
      console.log(`  [No green or red buttons detected on this page]`);
    }

    console.log(`  All Buttons sample:`);
    data.buttons.slice(0, 8).forEach(b => console.log(`   - "${b.text}" -> bg: ${b.bg}, color: ${b.color}`));
  }

  cdp.close();
  if (chromeProc) chromeProc.kill();
}

inspectAll().catch(err => {
  console.error(err);
  process.exit(1);
});
