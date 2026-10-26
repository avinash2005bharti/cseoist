import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173/login');
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhZGU0OWM2ZTg2NzZkMWEyZmI1NTc4ZCIsInJvbGUiOiJTVFVERU5UIiwiaWF0IjoxNzkzMDM5MjYwLCJleHAiOjE3OTM2NDQwNjB9.CNVXmdm8s_B0VFcXKuQpImxOA0qd91Q0oaMZHzxFXfk';
    const user = {
      id: '6ade49c6e8676d1a2fb5578d',
      name: 'Avinash Bharti',
      email: 'avinashbharti3007@gmail.com',
      role: 'STUDENT',
      mustChangePassword: false,
      isTG: false
    };

    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.clear();
        localStorage.setItem('campusflow_token', ${JSON.stringify(token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(user))});
        localStorage.setItem('campusflow_role', 'student');
        window.location.href = 'http://localhost:5173/student';
      `
    });
    await sleep(3500);

    // Open modal
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View Order'));
        if (btn) btn.click();
      })()`
    });
    await sleep(1500);

    // Intercept window.print in iframe or page so it doesn't block, and inspect the iframe HTML
    const iframeHtml = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const printBtn = document.querySelector('button.formal-print-btn');
        if (!printBtn) return { error: 'Print button not found' };

        // Save original print
        window._printTriggered = false;
        
        // Trigger handlePrint
        printBtn.click();

        const iframe = document.querySelector('iframe[name="campusflow_print_frame"]');
        if (!iframe) return { error: 'Iframe not found' };

        const doc = iframe.contentWindow.document;
        return {
          hasIframe: true,
          title: doc.title,
          html: doc.documentElement.outerHTML
        };
      })()`
    });

    console.log('Iframe Created:', iframeHtml.result.value?.hasIframe, iframeHtml.result.value?.title);

    if (iframeHtml.result.value?.html) {
      fs.writeFileSync('ui-audit/print_iframe.html', iframeHtml.result.value.html);
      console.log('Saved ui-audit/print_iframe.html');
    }

    // Now let's open ui-audit/print_iframe.html in a page and capture its screenshot and printToPDF!
    const { cdp: iframeCdp } = await createPage('file:///c:/Users/HP/OneDrive/Desktop/consideration%20management/ui-audit/print_iframe.html');
    await sleep(1500);

    const sIframe = await iframeCdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ui-audit/verified_official_letter_rendered.png', Buffer.from(sIframe.data, 'base64'));
    console.log('Saved ui-audit/verified_official_letter_rendered.png');

    const pdfRes = await iframeCdp.send('Page.printToPDF', {
      paperWidth: 8.27,
      paperHeight: 11.69,
      marginTop: 0.4,
      marginBottom: 0.4,
      marginLeft: 0.5,
      marginRight: 0.5,
      printBackground: true
    });
    fs.writeFileSync('ui-audit/verified_official_letter.pdf', Buffer.from(pdfRes.data, 'base64'));
    console.log('Saved ui-audit/verified_official_letter.pdf');

  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
