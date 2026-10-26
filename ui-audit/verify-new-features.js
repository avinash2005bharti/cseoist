import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/login');
    const authTokens = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json', 'utf8'));
    const studentAuth = authTokens.student;
    const hodAuth = authTokens.hod;

    console.log('=== TEST 1: Student Group Apply Consideration Directory ===');
    // Set student auth
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
        localStorage.setItem('campusflow_token', ${JSON.stringify(studentAuth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(studentAuth.user))});
        localStorage.setItem('campusflow_role', 'student');
        window.location.href = 'http://localhost:5173/student';
      `
    });

    await sleep(3000);

    // Open Request Consideration modal via Full Form button
    await cdp.send('Runtime.evaluate', {
      expression: `
        const applyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Full Form') || b.textContent.includes('Apply Consideration'));
        if (applyBtn) applyBtn.click();
      `
    });

    await sleep(1500);

    // Switch to Group Consideration tab
    const groupSwitchRes = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const groupBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Group / Team') || b.textContent.includes('Team Request'));
        if (groupBtn) {
          groupBtn.click();
          return { clicked: true };
        }
        return { clicked: false, buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()) };
      })()`
    });
    console.log('Clicked Group Tab:', groupSwitchRes.result.value);

    await sleep(2000);

    // Verify student roster count & list items in group selection
    const rosterCheck = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        // Look for student candidates roster
        const rosterContainer = document.querySelector('.max-h-44');
        if (!rosterContainer) return { error: 'roster container not found' };
        const studentCards = Array.from(rosterContainer.querySelectorAll('.p-2\\.5, [class*="hover:bg-purple"]'));
        const studentDetails = studentCards.map(c => c.textContent.trim().replace(/\\s+/g, ' '));
        return {
          totalCards: studentCards.length,
          sampleStudents: studentDetails.slice(0, 5),
        };
      })()`
    });
    console.log('Student Roster In Group Modal:', rosterCheck.result.value);

    // Capture screenshot of group modal
    const groupScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/group-roster-verified.png', Buffer.from(groupScreenshot.data, 'base64'));
    console.log('Saved screenshot: ui-audit/group-roster-verified.png');

    console.log('\n=== TEST 2: HOD Dashboard TG Consideration History & Tabs ===');
    // Set HOD auth
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
        localStorage.setItem('campusflow_token', ${JSON.stringify(hodAuth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(hodAuth.user))});
        localStorage.setItem('campusflow_role', 'hod');
        window.location.href = 'http://localhost:5173/hod/tg-recommendations';
      `
    });

    await sleep(3500);

    // Check tabs and their counts on TG Recommendations page
    const tabsCheck = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const tabBtns = Array.from(document.querySelectorAll('button')).filter(b => 
          b.textContent.includes('Awaiting HOD') ||
          b.textContent.includes('All Applications') ||
          b.textContent.includes('Attendance') ||
          b.textContent.includes('Leave') ||
          b.textContent.includes('Sanctioned') ||
          b.textContent.includes('Declined')
        );
        return tabBtns.map(b => b.textContent.trim().replace(/\\s+/g, ' '));
      })()`
    });
    console.log('HOD TG Recommendations Tabs & Counts:', tabsCheck.result.value);

    // Click "Sanctioned / Approved" tab to verify approved history displays
    await cdp.send('Runtime.evaluate', {
      expression: `
        const approvedTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sanctioned / Approved') || b.textContent.includes('Approved'));
        if (approvedTab) approvedTab.click();
      `
    });
    await sleep(1000);

    const approvedTabCards = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const cards = document.querySelectorAll('.rounded-2xl.border');
        return {
          count: cards.length,
          sampleApproved: Array.from(cards).slice(0, 3).map(c => {
            const title = c.querySelector('.font-extrabold')?.textContent.trim();
            const badge = c.querySelector('.rounded-full')?.textContent.trim();
            return { title, badge };
          })
        };
      })()`
    });
    console.log('Sanctioned / Approved tab contents:', approvedTabCards.result.value);

    // Click "Declined / Rejected" tab to verify declined history displays
    await cdp.send('Runtime.evaluate', {
      expression: `
        const declinedTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Declined / Rejected') || b.textContent.includes('Declined'));
        if (declinedTab) declinedTab.click();
      `
    });
    await sleep(1000);

    const declinedTabCards = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const cards = document.querySelectorAll('.rounded-2xl.border');
        return {
          count: cards.length,
          sampleDeclined: Array.from(cards).slice(0, 3).map(c => {
            const title = c.querySelector('.font-extrabold')?.textContent.trim();
            const badge = c.querySelector('.rounded-full')?.textContent.trim();
            return { title, badge };
          })
        };
      })()`
    });
    console.log('Declined / Rejected tab contents:', declinedTabCards.result.value);

    // Capture screenshot of HOD TG Recommendations
    const hodScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/hod-tg-history-verified.png', Buffer.from(hodScreenshot.data, 'base64'));
    console.log('Saved screenshot: ui-audit/hod-tg-history-verified.png');

    console.log('\n=== TEST 3: Decline / Reject Modal Remarks Optional ===');
    // Switch to Awaiting HOD Sign-off tab and click Decline on a card to test modal UI
    await cdp.send('Runtime.evaluate', {
      expression: `
        const awaitingTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Awaiting HOD'));
        if (awaitingTab) awaitingTab.click();
      `
    });
    await sleep(1000);

    const openDeclineModal = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const declineBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Decline');
        if (declineBtn) {
          declineBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()`
    });
    console.log('Clicked Decline button:', openDeclineModal.result.value);
    await sleep(1000);

    const modalRemarksCheck = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const textarea = document.querySelector('textarea');
        const label = textarea?.closest('div')?.querySelector('label')?.textContent.trim();
        return {
          label,
          placeholder: textarea?.getAttribute('placeholder'),
          isRequired: textarea?.hasAttribute('required') && textarea?.getAttribute('required') !== 'false'
        };
      })()`
    });
    console.log('Decline Modal Remarks Properties:', modalRemarksCheck.result.value);

    const modalScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/decline-modal-optional-remarks.png', Buffer.from(modalScreenshot.data, 'base64'));
    console.log('Saved screenshot: ui-audit/decline-modal-optional-remarks.png');

  } finally {
    await chrome.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
