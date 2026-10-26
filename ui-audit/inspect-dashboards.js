import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const tokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit/auth-tokens.json'), 'utf8'));

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function inspectDashboards() {
  const chromeProc = await launchChrome();
  const { cdp } = await createPage('http://localhost:5173/login');
  await sleep(1500);

  const dashboards = [
    { name: 'HOD Dashboard', url: 'http://localhost:5173/hod', token: tokens.hod },
    { name: 'HOD Considerations', url: 'http://localhost:5173/hod/considerations', token: tokens.hod },
    { name: 'TG Dashboard', url: 'http://localhost:5173/tg', token: tokens.tg },
    { name: 'TG Requests', url: 'http://localhost:5173/tg/requests', token: tokens.tg },
    { name: 'Student Dashboard', url: 'http://localhost:5173/student', token: tokens.student },
    { name: 'Student Requests', url: 'http://localhost:5173/student/requests', token: tokens.student }
  ];

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  for (const dash of dashboards) {
    console.log(`\n======================================================`);
    console.log(`=== Inspecting ${dash.name} (${dash.url}) ===`);
    console.log(`======================================================`);

    await cdp.send('Page.navigate', { url: 'http://localhost:5173/login' });
    await sleep(600);

    // Set auth token
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('cf_access_token', '${dash.token}');
        localStorage.setItem('campusflow_token', '${dash.token}');
      `
    });

    await cdp.send('Page.navigate', { url: dash.url });
    await sleep(2500);

    // Inspect buttons, roles, and option elements
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const results = [];
        const nodes = Array.from(document.querySelectorAll('button, [role="button"], select, .filter-bar select, .action-bar select, [role="tab"], .btn'));
        for (const el of nodes) {
          const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').substring(0, 50);
          if (!text && el.tagName !== 'SELECT') continue;
          const style = window.getComputedStyle(el);
          results.push({
            tag: el.tagName,
            text: text || el.name || 'select',
            className: (el.className || '').substring(0, 60),
            bgColor: style.backgroundColor,
            color: style.color,
            borderColor: style.borderColor,
            borderRadius: style.borderRadius
          });
        }
        return results;
      })()`,
      returnByValue: true
    });

    const elements = result.value || [];
    console.log(`Found ${elements.length} interactive elements on ${dash.name}:`);
    for (const el of elements) {
      const isGreen = el.bgColor.includes('16, 185, 129') || el.bgColor.includes('5, 150, 105') || el.bgColor.includes('236, 253, 245') || el.color.includes('16, 185, 129') || el.color.includes('6, 95, 70') || el.color.includes('5, 150, 105');
      const isRed = el.bgColor.includes('225, 29, 72') || el.bgColor.includes('244, 63, 94') || el.bgColor.includes('255, 241, 242') || el.color.includes('225, 29, 72') || el.color.includes('159, 18, 57') || el.color.includes('244, 63, 94');
      const marker = isGreen ? ' [GREEN DETECTED]' : isRed ? ' [RED DETECTED]' : '';
      console.log(` [${el.tag}] "${el.text}" | bg: ${el.bgColor} | color: ${el.color} | border: ${el.borderColor} | radius: ${el.borderRadius}${marker}`);
    }
  }

  cdp.close();
  if (chromeProc) chromeProc.kill();
}

inspectDashboards().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
