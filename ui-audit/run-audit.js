import { launchChrome, createPage, captureScreenshot } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'http://localhost:5000/api/v1';
const APP_BASE = 'http://localhost:5173';
const OUTPUT_STAGE = process.argv[2] || 'before'; // 'before' or 'after'
const OUTPUT_DIR = path.resolve('ui-audit', OUTPUT_STAGE);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const authTokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit', 'auth-tokens.json'), 'utf8'));

const VIEWPORTS = [
  { name: '1440px', width: 1440, height: 900 },
  { name: '1024px', width: 1024, height: 768 },
  { name: '768px', width: 768, height: 1024 },
  { name: '375px', width: 375, height: 812 },
];

async function setAuth(cdp, authData) {
  if (!authData) {
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
      `,
    });
    return;
  }
  const expr = `
    localStorage.setItem('campusflow_token', ${JSON.stringify(authData.token)});
    localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authData.user))});
    localStorage.setItem('campusflow_role', ${JSON.stringify(authData.role)});
  `;
  await cdp.send('Runtime.evaluate', { expression: expr });
}

async function checkHorizontalOverflow(cdp) {
  const evalRes = await cdp.send('Runtime.evaluate', {
    expression: `
      ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        windowInnerWidth: window.innerWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
      })
    `,
    returnByValue: true,
  });
  return evalRes.result?.value;
}

async function main() {
  console.log(`Starting UI Audit for stage: [${OUTPUT_STAGE}]...`);
  const chromeProc = await launchChrome();
  console.log('Headless Chrome launched.');

  const auditReport = [];

  try {
    const { cdp } = await createPage(`${APP_BASE}/login`);

    // 1. PUBLIC PAGES
    console.log('\n--- Auditing Public Pages ---');
    await setAuth(cdp, null);

    const publicPages = [
      { name: 'login', path: '/login' },
      { name: 'register', path: '/register' },
    ];

    for (const page of publicPages) {
      for (const vp of VIEWPORTS) {
        console.log(`Checking ${page.name} at ${vp.name}...`);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.width < 768,
        });
        await cdp.send('Page.navigate', { url: `${APP_BASE}${page.path}` });
        await sleep(2000);

        const overflow = await checkHorizontalOverflow(cdp);
        const screenshotFile = path.join(OUTPUT_DIR, `${page.name}-${vp.name}.png`);
        await captureScreenshot(cdp, screenshotFile, vp);

        auditReport.push({
          page: page.name,
          path: page.path,
          viewport: vp.name,
          width: vp.width,
          overflow,
          screenshot: path.relative(process.cwd(), screenshotFile),
        });
      }
    }

    // 2. HOD PORTAL
    console.log('\n--- Auditing HOD Portal ---');
    const hodAuth = authTokens.hod;
    await cdp.send('Page.navigate', { url: `${APP_BASE}/login` });
    await sleep(500);
    await setAuth(cdp, hodAuth);

    const hodPages = [
      { name: 'hod-dashboard', path: '/hod' },
      { name: 'hod-considerations', path: '/hod/considerations' },
      { name: 'hod-leaves', path: '/hod/leaves' },
      { name: 'hod-sections', path: '/hod/sections' },
      { name: 'hod-mentorship', path: '/hod/mentorship' },
      { name: 'hod-students', path: '/hod/students' },
      { name: 'hod-teachers', path: '/hod/teachers' },
      { name: 'hod-reports', path: '/hod/reports' },
    ];

    for (const page of hodPages) {
      for (const vp of VIEWPORTS) {
        console.log(`Checking ${page.name} at ${vp.name}...`);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.width < 768,
        });
        await cdp.send('Page.navigate', { url: `${APP_BASE}${page.path}` });
        await sleep(2500);

        const overflow = await checkHorizontalOverflow(cdp);
        const screenshotFile = path.join(OUTPUT_DIR, `${page.name}-${vp.name}.png`);
        await captureScreenshot(cdp, screenshotFile, vp);

        auditReport.push({
          page: page.name,
          path: page.path,
          viewport: vp.name,
          width: vp.width,
          overflow,
          screenshot: path.relative(process.cwd(), screenshotFile),
        });
      }
    }

    // 3. STUDENT PORTAL
    console.log('\n--- Auditing Student Portal ---');
    const studentAuth = authTokens.student;
    await setAuth(cdp, studentAuth);

    const studentPages = [
      { name: 'student-dashboard', path: '/student' },
      { name: 'student-requests', path: '/student/requests' },
      { name: 'student-considerations', path: '/student/considerations' },
      { name: 'student-leaves', path: '/student/leaves' },
      { name: 'student-profile', path: '/student/profile' },
    ];

    for (const page of studentPages) {
      for (const vp of VIEWPORTS) {
        console.log(`Checking ${page.name} at ${vp.name}...`);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.width < 768,
        });
        await cdp.send('Page.navigate', { url: `${APP_BASE}${page.path}` });
        await sleep(2000);

        const overflow = await checkHorizontalOverflow(cdp);
        const screenshotFile = path.join(OUTPUT_DIR, `${page.name}-${vp.name}.png`);
        await captureScreenshot(cdp, screenshotFile, vp);

        auditReport.push({
          page: page.name,
          path: page.path,
          viewport: vp.name,
          width: vp.width,
          overflow,
          screenshot: path.relative(process.cwd(), screenshotFile),
        });
      }
    }

    // 4. TG PORTAL
    console.log('\n--- Auditing TG Portal ---');
    const tgAuth = authTokens.tg;
    await setAuth(cdp, tgAuth);

    const tgPages = [
      { name: 'tg-dashboard', path: '/tg' },
      { name: 'tg-requests', path: '/tg/requests' },
      { name: 'tg-students', path: '/tg/students' },
    ];

    for (const page of tgPages) {
      for (const vp of VIEWPORTS) {
        console.log(`Checking ${page.name} at ${vp.name}...`);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.width < 768,
        });
        await cdp.send('Page.navigate', { url: `${APP_BASE}${page.path}` });
        await sleep(2000);

        const overflow = await checkHorizontalOverflow(cdp);
        const screenshotFile = path.join(OUTPUT_DIR, `${page.name}-${vp.name}.png`);
        await captureScreenshot(cdp, screenshotFile, vp);

        auditReport.push({
          page: page.name,
          path: page.path,
          viewport: vp.name,
          width: vp.width,
          overflow,
          screenshot: path.relative(process.cwd(), screenshotFile),
        });
      }
    }

    // 5. MODAL TEST (Open a representative modal)
    console.log('\n--- Testing Representative Modal ---');
    await setAuth(cdp, hodAuth);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${APP_BASE}/hod/sections` });
    await sleep(2000);

    // Click a button to open modal if present
    await cdp.send('Runtime.evaluate', {
      expression: `
        const btn = document.querySelector('button.btn-primary') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Section') || b.textContent.includes('Add') || b.textContent.includes('New'));
        if (btn) btn.click();
      `,
    });
    await sleep(1000);
    const modalScreenshot = path.join(OUTPUT_DIR, 'modal-section-1440px.png');
    await captureScreenshot(cdp, modalScreenshot, { width: 1440, height: 900 });

    cdp.close();

    const reportPath = path.join(OUTPUT_DIR, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
    console.log(`\nAudit completed successfully! Saved ${auditReport.length} screenshot records to ${reportPath}`);
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch((err) => {
  console.error('Audit run error:', err);
  process.exit(1);
});
