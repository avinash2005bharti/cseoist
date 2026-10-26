import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const APP_BASE = 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('ui-audit', 'student_verified');

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
  const studentAuth = authTokens.studentAvinash || authTokens.student;

  console.log('Verifying Student Sidebar changes...');
  const chromeProc = await launchChrome();

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);
    await setAuth(cdp, studentAuth);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Emulation.setVisibleSize', { width: 1440, height: 900 });

    // Navigate to student dashboard
    await cdp.send('Page.navigate', { url: `${APP_BASE}/student` });
    await sleep(2000);

    // Read sidebar links text
    const sidebarEval = await cdp.send('Runtime.evaluate', {
      expression: `
        Array.from(document.querySelectorAll('.sidebar nav a.nav-link')).map(el => ({
          text: el.innerText.trim(),
          href: el.getAttribute('href')
        }))
      `,
      returnByValue: true
    });
    console.log('Sidebar links detected:', sidebarEval.result.value);

    // Check screenshot of student dashboard with sidebar
    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'student-dashboard-sidebar.png'), { width: 1440, height: 900 });
    console.log('Captured student-dashboard-sidebar.png');

    // Click on Considerations sidebar link
    await cdp.send('Runtime.evaluate', {
      expression: `
        const link = Array.from(document.querySelectorAll('.sidebar nav a.nav-link')).find(el => el.innerText.includes('Considerations'));
        if (link) link.click();
      `
    });
    await sleep(2500);

    const considerationsUrl = await cdp.send('Runtime.evaluate', {
      expression: `window.location.pathname`,
      returnByValue: true
    });
    console.log('Current URL after clicking Considerations:', considerationsUrl.result.value);

    const considerationsInfo = await cdp.send('Runtime.evaluate', {
      expression: `
        ({
          rowCount: document.querySelectorAll('table tbody tr').length,
          hasDetailsDrawer: document.querySelectorAll('.card').length > 1 || Boolean(document.querySelector('.border-blue-200')),
          firstRowText: document.querySelector('table tbody tr')?.innerText?.replace(/\\s+/g, ' ') || 'None'
        })
      `,
      returnByValue: true
    });
    console.log('Considerations page state:', considerationsInfo.result.value);

    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'student-considerations.png'), { width: 1440, height: 900 });
    console.log('Captured student-considerations.png');

    // Click on Leaves sidebar link
    const clickLeavesResult = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const links = Array.from(document.querySelectorAll('.sidebar nav a.nav-link'));
          const target = links.find(el => el.innerText.includes('Leaves'));
          if (!target) return { found: false, links: links.map(l => l.innerText) };
          target.click();
          return { found: true, href: target.getAttribute('href'), text: target.innerText };
        })()
      `,
      returnByValue: true
    });
    console.log('Click Leaves evaluated:', clickLeavesResult.result.value);
    await sleep(2500);

    const leavesUrl = await cdp.send('Runtime.evaluate', {
      expression: `window.location.pathname`,
      returnByValue: true
    });
    console.log('Current URL after clicking Leaves:', leavesUrl.result.value);

    const leavesInfo = await cdp.send('Runtime.evaluate', {
      expression: `
        ({
          rowCount: document.querySelectorAll('table tbody tr').length,
          hasDetailsDrawer: document.querySelectorAll('.card').length > 1 || Boolean(document.querySelector('.border-blue-200')),
          firstRowText: document.querySelector('table tbody tr')?.innerText?.replace(/\\s+/g, ' ') || 'None'
        })
      `,
      returnByValue: true
    });
    console.log('Leaves page state:', leavesInfo.result.value);

    await captureScreenshot(cdp, path.join(OUTPUT_DIR, 'student-leaves.png'), { width: 1440, height: 900 });
    console.log('Captured student-leaves.png');

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch(console.error);
