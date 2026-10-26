import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'dashboard-checks');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreen(cdp, filename, width = 1440, height = 900) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(400);

  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true
  });
  const fullPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(fullPath, Buffer.from(data, 'base64'));
  console.log(`Saved screenshot: ${filename} (${width}x${height})`);
}

async function loginAs(cdp, roleName, email, password) {
  console.log(`\nLogging in as ${roleName} (${email})...`);
  await cdp.send('Page.navigate', { url: `${APP_BASE}/login` });
  await sleep(1500);

  // Clear any existing session
  await cdp.send('Runtime.evaluate', {
    expression: 'localStorage.clear();'
  });

  // Select role tab
  await cdp.send('Runtime.evaluate', {
    expression: `
      const tabs = Array.from(document.querySelectorAll('.auth-role-tab'));
      const targetTab = tabs.find(t => t.textContent.toLowerCase().includes('${roleName.toLowerCase()}'));
      if (targetTab) targetTab.click();
    `
  });
  await sleep(400);

  // Fill in inputs using native prototype setter
  await cdp.send('Runtime.evaluate', {
    expression: `
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const emailInput = document.querySelector('input[type="email"]');
      const passInput = document.querySelector('input[type="password"]');
      if (emailInput && passInput) {
        nativeSetter.call(emailInput, '${email}');
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));

        nativeSetter.call(passInput, '${password}');
        passInput.dispatchEvent(new Event('input', { bubbles: true }));

        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
      }
    `
  });
  await sleep(3500);

  const { result } = await cdp.send('Runtime.evaluate', {
    expression: 'window.location.href',
    returnByValue: true
  });
  console.log(`Logged in! Current URL: ${result.value}`);
}

async function inspectButtonsAndOptions(cdp, pageName) {
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const summary = {
        buttons: [],
        options: [],
        greenButtons: [],
        redButtons: []
      };

      // Query buttons
      document.querySelectorAll('button, .btn').forEach(btn => {
        const text = (btn.innerText || btn.textContent || '').trim().replace(/\\s+/g, ' ').substring(0, 50);
        if (!text) return;
        const s = window.getComputedStyle(btn);
        const item = {
          text,
          bg: s.backgroundColor,
          color: s.color,
          border: s.borderColor,
          radius: s.borderRadius
        };
        summary.buttons.push(item);

        // Check if green
        const isGreen = s.backgroundColor.includes('16, 185, 129') ||
                        s.backgroundColor.includes('5, 150, 105') ||
                        s.backgroundColor.includes('236, 253, 245') ||
                        s.color.includes('16, 185, 129') ||
                        s.color.includes('6, 95, 70') ||
                        s.color.includes('5, 150, 105');
        // Check if red
        const isRed = s.backgroundColor.includes('225, 29, 72') ||
                      s.backgroundColor.includes('244, 63, 94') ||
                      s.backgroundColor.includes('255, 241, 242') ||
                      s.color.includes('225, 29, 72') ||
                      s.color.includes('159, 18, 57') ||
                      s.color.includes('244, 63, 94');

        if (isGreen) summary.greenButtons.push(item);
        if (isRed) summary.redButtons.push(item);
      });

      // Query select/options and option pills
      document.querySelectorAll('select, div:has(select), [role="tab"], .filter-bar, .action-bar').forEach(el => {
        const text = (el.innerText || el.value || '').trim().replace(/\\s+/g, ' ').substring(0, 50);
        const s = window.getComputedStyle(el);
        summary.options.push({
          tag: el.tagName,
          text,
          bg: s.backgroundColor,
          color: s.color,
          border: s.borderColor,
          radius: s.borderRadius
        });
      });

      return summary;
    })()`,
    returnByValue: true
  });

  const res = result.value || { buttons: [], options: [], greenButtons: [], redButtons: [] };
  console.log(`\n--- Verification for ${pageName} ---`);
  console.log(`Total Buttons: ${res.buttons.length} | Green Buttons: ${res.greenButtons.length} | Red Buttons: ${res.redButtons.length}`);
  if (res.greenButtons.length > 0) {
    console.log('WARNING: Green buttons still present:', res.greenButtons);
  }
  if (res.redButtons.length > 0) {
    console.log('WARNING: Red buttons still present:', res.redButtons);
  }
  console.log(`Sample buttons on ${pageName}:`);
  res.buttons.slice(0, 6).forEach(b => {
    console.log(`  * "${b.text}" -> bg: ${b.bg}, color: ${b.color}, border: ${b.border}`);
  });
  console.log(`Sample option selectors on ${pageName}:`);
  res.options.slice(0, 4).forEach(o => {
    console.log(`  * [${o.tag}] "${o.text}" -> color: ${o.color}, border: ${o.border}, radius: ${o.radius}`);
  });
}

async function run() {
  const chromeProc = await launchChrome();
  const { cdp } = await createPage(`${APP_BASE}/login`);

  try {
    // 1. HOD FLOW
    await loginAs(cdp, 'HOD', 'hod@campusflow.edu', 'Password@123');
    await cdp.send('Page.navigate', { url: `${APP_BASE}/hod` });
    await sleep(2500);
    await inspectButtonsAndOptions(cdp, 'HOD Dashboard');
    await captureScreen(cdp, 'hod-dashboard-redesigned.png');

    await cdp.send('Page.navigate', { url: `${APP_BASE}/hod/considerations` });
    await sleep(2500);
    await inspectButtonsAndOptions(cdp, 'HOD Considerations');
    await captureScreen(cdp, 'hod-considerations-redesigned.png');

    // 2. TG FLOW
    await loginAs(cdp, 'TG', 'test_teacher@mail.in', 'Password@123');
    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg` });
    await sleep(2500);
    await inspectButtonsAndOptions(cdp, 'TG Dashboard');
    await captureScreen(cdp, 'tg-dashboard-redesigned.png');

    await cdp.send('Page.navigate', { url: `${APP_BASE}/tg/requests` });
    await sleep(2500);
    await inspectButtonsAndOptions(cdp, 'TG Requests');
    await captureScreen(cdp, 'tg-requests-redesigned.png');

    // 3. STUDENT FLOW
    await loginAs(cdp, 'Student', 'ayushmishra2372005@gmail.com', 'Password@123');
    await cdp.send('Page.navigate', { url: `${APP_BASE}/student` });
    await sleep(2500);
    await inspectButtonsAndOptions(cdp, 'Student Dashboard');
    await captureScreen(cdp, 'student-dashboard-redesigned.png');

    await cdp.send('Page.navigate', { url: `${APP_BASE}/student/requests` });
    await sleep(2500);
    await inspectButtonsAndOptions(cdp, 'Student Requests');
    await captureScreen(cdp, 'student-requests-redesigned.png');

    console.log('\nAll dashboard verification runs completed successfully!');
  } finally {
    cdp.close();
    if (chromeProc) chromeProc.kill();
  }
}

run().catch(err => {
  console.error('Run failed:', err);
  process.exit(1);
});
