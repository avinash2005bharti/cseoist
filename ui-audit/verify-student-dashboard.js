import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/student');
    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).student;

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', 'student');
        window.location.href = 'http://localhost:5173/student';
      `
    });

    await sleep(3000);

    // 1. VERIFY TOGGLE BUTTON LOGIC
    console.log('--- 1. Testing Toggle Buttons ---');
    const toggleState1 = await cdp.send('Runtime.evaluate', {
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
    console.log('Sidebar Open State:', toggleState1.result.value);

    // Click sidebar toggle button to collapse
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const sidebarBtn = document.querySelector('.sidebar-collapse-btn');
        if (sidebarBtn) sidebarBtn.click();
      })()`
    });
    await sleep(1000);

    const toggleState2 = await cdp.send('Runtime.evaluate', {
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
    console.log('Sidebar Closed State:', toggleState2.result.value);

    const sClosed = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/toggle_sidebar_closed.png', Buffer.from(sClosed.data, 'base64'));

    // Reopen sidebar via header button
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const headerBtn = document.querySelector('header button[aria-label="Toggle Navigation Menu"]');
        if (headerBtn) headerBtn.click();
      })()`
    });
    await sleep(1000);

    // 2. VERIFY ACTIVE SELECTOR STYLING IN MODAL
    console.log('--- 2. Testing Active Selector in Modal ---');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Apply') || b.textContent.includes('+ Apply'));
        if (btn) btn.click();
      })()`
    });
    await sleep(1500);

    // Scroll modal container down so presets are fully visible
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const container = document.querySelector('.modal-container');
        if (container) container.scrollTop = container.scrollHeight / 2;
      })()`
    });
    await sleep(500);

    // Click "Full Day" preset in modal
    const modalPresetCheck = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const presets = Array.from(document.querySelectorAll('.modal-container .schedule-preset-btn'));
        const fullDayBtn = presets.find(b => b.textContent.includes('Full Day'));
        if (fullDayBtn) fullDayBtn.click();
        
        const style = fullDayBtn ? window.getComputedStyle(fullDayBtn) : null;
        return {
          found: Boolean(fullDayBtn),
          text: fullDayBtn?.textContent?.trim(),
          backgroundColor: style?.backgroundColor,
          color: style?.color,
          borderColor: style?.borderColor
        };
      })()`
    });
    console.log('Modal Active Preset Button Style:', modalPresetCheck.result.value);

    const sModal = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/live_modal_active_preset.png', Buffer.from(sModal.data, 'base64'));

    // Close modal via top-right close button or backdrop
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const closeBtn = document.querySelector('.modal-container button');
        if (closeBtn) closeBtn.click();
      })()`
    });
    await sleep(1000);

    // 3. VERIFY QUICK CONSIDERATION FORM IN DASHBOARD COLUMN 2
    console.log('--- 3. Testing Quick Consideration Form in Dashboard Column 2 ---');
    const formFillResult = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const form = document.querySelector('.student-quick-form');
        if (!form) return { error: 'student-quick-form not found' };

        const setVal = (el, val) => {
          const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
          descriptor.set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const eventNameInput = document.getElementById('quick-event-name');
        setVal(eventNameInput, 'National Robotics & Coding Championship');

        const startDateInput = document.getElementById('quick-start-date');
        setVal(startDateInput, '2026-10-28');

        const endDateInput = document.getElementById('quick-end-date');
        setVal(endDateInput, '2026-10-28');

        // Select P1 and P2
        const p1Cb = form.querySelector('label:has(span:first-of-type) input[type="checkbox"]');
        const allCheckboxes = Array.from(form.querySelectorAll('input[type="checkbox"]'));
        if (allCheckboxes[0] && !allCheckboxes[0].checked) allCheckboxes[0].click();
        if (allCheckboxes[1] && !allCheckboxes[1].checked) allCheckboxes[1].click();

        // Click Morning preset in quick form
        const presetBtns = Array.from(form.querySelectorAll('.schedule-preset-btn'));
        const morningBtn = presetBtns.find(b => b.textContent.includes('Morning'));
        if (morningBtn) morningBtn.click();

        // Fill justification
        const justInput = document.getElementById('quick-justification');
        setVal(justInput, 'Official departmental selection for national robotics competition.');

        const morningStyle = morningBtn ? window.getComputedStyle(morningBtn) : null;

        return {
          success: true,
          eventName: eventNameInput.value,
          justification: justInput.value,
          presetActive: {
            text: morningBtn?.textContent?.trim(),
            backgroundColor: morningStyle?.backgroundColor,
            color: morningStyle?.color
          }
        };
      })()`
    });
    console.log('Dashboard Form Fill and Preset Check:', formFillResult.result.value);

    const sDashboardForm = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/live_dashboard_filled_form.png', Buffer.from(sDashboardForm.data, 'base64'));

    // Submit the form
    console.log('--- Submitting Dashboard Consideration Form ---');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const form = document.querySelector('.student-quick-form');
        const submitBtn = form?.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()`
    });

    await sleep(3500);

    const afterSubmitCheck = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const pageText = document.body.innerText;
        const hasCreatedApp = pageText.includes('National Robotics & Coding Championship');
        const toasts = Array.from(document.querySelectorAll('[role="alert"], div')).map(e => e.textContent).filter(t => t.includes('Submitted') || t.includes('forwarded'));
        return {
          hasCreatedApp,
          toastsFound: toasts.slice(0, 3)
        };
      })()`
    });
    console.log('Post Submission Verification:', afterSubmitCheck.result.value);

    const sFinal = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/live_dashboard_after_submit.png', Buffer.from(sFinal.data, 'base64'));

  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
