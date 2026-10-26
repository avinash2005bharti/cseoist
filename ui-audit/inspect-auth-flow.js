import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function test() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('http://localhost:5173');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    cdp.on('Network.requestWillBeSent', (params) => {
      if (params.request.url.includes('/api/')) {
        console.log('REQ WILL BE SENT:', params.request.method, params.request.url);
      }
    });

    cdp.on('Network.responseReceived', (params) => {
      if (params.response.url.includes('/api/')) {
        console.log('RESP RECEIVED:', params.response.status, params.response.url);
      }
    });

    cdp.on('Network.loadingFailed', (params) => {
      console.log('LOADING FAILED:', params.errorText, params.requestId);
    });

    const auth = JSON.parse(fs.readFileSync('ui-audit/auth-tokens.json')).hod;
    
    await cdp.send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('campusflow_token', ${JSON.stringify(auth.token)});
        localStorage.setItem('campusflow_user', ${JSON.stringify(JSON.stringify(auth.user))});
        localStorage.setItem('campusflow_role', 'hod');
        window.location.href = 'http://localhost:5173/hod';
      `
    });

    await new Promise(r => setTimeout(r, 6000));
  } finally {
    chrome.kill();
  }
}
test().catch(console.error);
