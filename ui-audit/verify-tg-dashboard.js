import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/tg');
    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).tg;

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', 'tg');
        window.location.href = 'http://localhost:5173/tg';
      `
    });

    await sleep(3000);

    // 1. VERIFY TOGGLE BUTTON IN TG DASHBOARD
    console.log('--- 1. Testing Toggle Button in TG Dashboard ---');
    const tgToggleState1 = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const headerBtn = document.querySelector('header button[aria-label="Toggle Navigation Menu"]');
        const sidebarBtn = document.querySelector('.sidebar-collapse-btn');
        return {
          headerButtonVisible: Boolean(headerBtn && headerBtn.offsetParent !== null),
          sidebarButtonVisible: Boolean(sidebarBtn && sidebarBtn.offsetParent !== null),
        };
      })()`
    });
    console.log('TG Sidebar Open State:', tgToggleState1.result.value);

    // Click collapse
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const sidebarBtn = document.querySelector('.sidebar-collapse-btn');
        if (sidebarBtn) sidebarBtn.click();
      })()`
    });
    await sleep(1000);

    const tgToggleState2 = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const headerBtn = document.querySelector('header button[aria-label="Toggle Navigation Menu"]');
        const sidebarBtn = document.querySelector('.sidebar-collapse-btn');
        return {
          headerButtonVisible: Boolean(headerBtn && headerBtn.offsetParent !== null),
          sidebarButtonVisible: Boolean(sidebarBtn && sidebarBtn.offsetParent !== null),
        };
      })()`
    });
    console.log('TG Sidebar Closed State:', tgToggleState2.result.value);

    // Reopen sidebar
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const headerBtn = document.querySelector('header button[aria-label="Toggle Navigation Menu"]');
        if (headerBtn) headerBtn.click();
      })()`
    });
    await sleep(1000);

    // 2. VERIFY NOTIFICATION BUTTON IN TG DASHBOARD
    console.log('--- 2. Testing Notification Bell in TG Dashboard ---');
    const notifBtnCheck = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const notifBtn = document.querySelector('header button[aria-label="View notifications"]');
        if (!notifBtn) return { error: 'notifBtn not found' };

        const bellSvg = notifBtn.querySelector('svg');
        const badge = notifBtn.querySelector('.notif-badge-count, span');

        const btnStyle = window.getComputedStyle(notifBtn);
        const bellStyle = bellSvg ? window.getComputedStyle(bellSvg) : null;
        const badgeStyle = badge ? window.getComputedStyle(badge) : null;

        const bellRect = bellSvg?.getBoundingClientRect();
        const badgeRect = badge?.getBoundingClientRect();

        return {
          bellFound: Boolean(bellSvg),
          bellDisplay: bellStyle?.display,
          badgeFound: Boolean(badge),
          badgeText: badge?.textContent?.trim(),
          badgePosition: badgeStyle?.position,
          badgeTop: badgeStyle?.top,
          badgeRight: badgeStyle?.right,
          // Verify badge does not overlap bell center
          bellCenter: bellRect ? { x: bellRect.left + bellRect.width / 2, y: bellRect.top + bellRect.height / 2 } : null,
          badgeBounds: badgeRect ? { left: badgeRect.left, right: badgeRect.right, top: badgeRect.top, bottom: badgeRect.bottom } : null
        };
      })()`
    });
    console.log('TG Notification Button State:', notifBtnCheck.result.value);

    const sTgDashboard = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/live_tg_dashboard.png', Buffer.from(sTgDashboard.data, 'base64'));
    console.log('Saved ui-audit/live_tg_dashboard.png');

    // 3. VERIFY FORMAL APPLICATION MODAL (SANCTION DOCUMENT)
    console.log('--- 3. Testing Formal Sanctioned Application Document Modal ---');
    // Navigate to student dashboard or considerations where sanctioned document can be viewed
    await cdp.send('Runtime.evaluate', {
      expression: `
        const authStudent = ${JSON.stringify(JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).student)};
        localStorage.setItem('campusflow_token', authStudent.token);
        localStorage.setItem('campusflow_user', JSON.stringify(authStudent.user));
        localStorage.setItem('campusflow_role', 'student');
        window.location.href = 'http://localhost:5173/student';
      `
    });

    await sleep(3000);

    // Open "View Order" button
    const openedModal = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const viewOrderBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View Order'));
        if (viewOrderBtn) {
          viewOrderBtn.click();
          return { clicked: true, text: viewOrderBtn.textContent };
        }
        return { clicked: false };
      })()`
    });
    console.log('Clicked View Order:', openedModal.result.value);

    await sleep(1500);

    const sFormalModal = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/live_formal_application_modal.png', Buffer.from(sFormalModal.data, 'base64'));
    console.log('Saved ui-audit/live_formal_application_modal.png');

  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
