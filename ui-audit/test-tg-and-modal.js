import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/login');
    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).tg;

    // Set TG auth
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', 'tg');
        window.location.href = 'http://localhost:5173/tg';
      `
    });

    await sleep(3500);

    // 1. Check Toggle Buttons in TG Dashboard
    console.log('--- 1. TG Toggle Buttons Check ---');
    const toggleCheck = await cdp.send('Runtime.evaluate', {
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
    console.log('TG Toggle State (Sidebar Open):', toggleCheck.result.value);

    // 2. Check Notification Bell & Badge in TG Dashboard
    console.log('--- 2. TG Notification Bell & Badge Check ---');
    // Inject a sample badge to inspect exact positioning if unread is 0
    const notifCheck = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const notifBtn = document.querySelector('header button[aria-label="View notifications"]');
        if (!notifBtn) return { error: 'notifBtn not found' };

        // If no badge currently, inject a badge with '3' to inspect visual rendering
        let badge = notifBtn.querySelector('.notif-badge-count');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'notif-badge-count';
          badge.textContent = '3';
          badge.style.position = 'absolute';
          badge.style.top = '-4px';
          badge.style.right = '-4px';
          notifBtn.appendChild(badge);
        }

        const bellSvg = notifBtn.querySelector('svg');
        const bellRect = bellSvg.getBoundingClientRect();
        const badgeRect = badge.getBoundingClientRect();

        return {
          bellVisible: Boolean(bellSvg && bellSvg.offsetParent !== null),
          bellDimensions: { width: bellRect.width, height: bellRect.height },
          badgeDimensions: { width: badgeRect.width, height: badgeRect.height },
          badgePosition: { top: badge.style.top, right: badge.style.right },
          bellCenter: { x: bellRect.left + bellRect.width / 2, y: bellRect.top + bellRect.height / 2 },
          badgeCenter: { x: badgeRect.left + badgeRect.width / 2, y: badgeRect.top + badgeRect.height / 2 }
        };
      })()`
    });
    console.log('TG Notification Bell & Badge Result:', notifCheck.result.value);

    const sTgDashboard = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_tg_dashboard.png', Buffer.from(sTgDashboard.data, 'base64'));
    console.log('Saved ui-audit/verified_tg_dashboard.png');

    // 3. Render FormalApplicationModal with Image 2 data to verify pixel perfection
    console.log('--- 3. Testing Formal Sanction Document (Image 2) ---');
    const modalRender = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        // Find View Records or click a link to open Modal, or dispatch custom event / trigger modal
        // Let's check if the React component can be viewed on student dashboard
        return { ready: true };
      })()`
    });

    // Switch to student view to open the Sanction Order modal directly
    const authStudent = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).student;
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
        localStorage.setItem('campusflow_token', ${JSON.stringify(authStudent.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(authStudent.user))});
        localStorage.setItem('campusflow_role', 'student');
        window.location.href = 'http://localhost:5173/student';
      `
    });

    await sleep(3000);

    // Click "View Order" button on the first approved application (e.g. sports testing)
    const viewOrderClick = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const viewOrderBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View Order'));
        if (viewOrderBtn) {
          viewOrderBtn.click();
          return { found: true };
        }
        return { found: false };
      })()`
    });
    console.log('View Order Click:', viewOrderClick.result.value);

    await sleep(1500);

    const sModal = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_formal_application_modal.png', Buffer.from(sModal.data, 'base64'));
    console.log('Saved ui-audit/verified_formal_application_modal.png');

  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
