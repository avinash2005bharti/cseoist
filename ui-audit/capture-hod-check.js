import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';
import path from 'node:path';

const tokens = JSON.parse(fs.readFileSync(path.resolve('ui-audit/auth-tokens.json'), 'utf8'));

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chromeProc = await launchChrome();
  const { cdp } = await createPage('http://localhost:5173/login');
  await sleep(1000);

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  const hodData = tokens.hod;
  // Set HOD auth token, user, and role
  await cdp.send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('cf_access_token', ${JSON.stringify(hodData.token)});
      localStorage.setItem('campusflow_token', ${JSON.stringify(hodData.token)});
      localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(hodData.user))});
      localStorage.setItem('campusflow_role', 'hod');
    `
  });

  await cdp.send('Page.navigate', { url: 'http://localhost:5173/hod' });
  
  // Wait for loading to finish
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: `!document.body.innerText.includes('Authenticating Academic Session...') && !document.body.innerText.includes('Loading institutional data...')`
    });
    if (result.value) {
      break;
    }
  }

  await sleep(1000);

  const pageInfo = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const heading = document.querySelector('h1')?.innerText || document.querySelector('h2')?.innerText || '';
      const text = document.body.innerText.substring(0, 1000);
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
      return {
        url: window.location.href,
        heading,
        sampleText: text.replace(/\\n+/g, ' | '),
        buttonsCount: buttons.length,
        buttonsSample: buttons.slice(0, 15)
      };
    })()`,
    returnByValue: true
  });

  console.log('Page Info:', JSON.stringify(pageInfo.result.value, null, 2));

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.resolve('ui-audit/hod-dashboard-reverted.png');
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log(`Saved screenshot to ${outPath}`);

  try {
    process.kill(-chromeProc.pid);
  } catch (e) {
    try { chromeProc.kill(); } catch (err) {}
  }
}

run().catch(console.error);
