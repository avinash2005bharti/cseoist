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

    // Open modal via "+ Apply"
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const applyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Apply' || b.textContent.includes('+ Apply'));
        if (applyBtn) applyBtn.click();
      })()`
    });
    await sleep(1500);

    // Scroll modal container down
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.querySelector('.modal-container');
        if (modal) modal.scrollTop = 380;
      })()`
    });
    await sleep(500);

    // Click "Full Day" preset
    const presetStyle = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const fullDay = Array.from(document.querySelectorAll('.modal-container .schedule-preset-btn')).find(b => b.textContent.includes('Full Day'));
        if (fullDay) fullDay.click();
        const style = fullDay ? window.getComputedStyle(fullDay) : null;
        return {
          text: fullDay?.textContent,
          bg: style?.backgroundColor,
          color: style?.color,
          border: style?.borderColor
        };
      })()`
    });
    console.log('Full Day preset style in modal:', presetStyle.result.value);

    const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/modal_preset_active_verified.png', Buffer.from(s.data, 'base64'));

  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
