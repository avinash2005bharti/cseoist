import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function test() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('about:blank');
    const s25Base64 = fs.readFileSync('new_ui/Screen 25.png').toString('base64');
    await cdp.send('Runtime.evaluate', {
      expression: `window.s25Base64 = '${s25Base64}';`
    });

    const result = await cdp.send('Runtime.evaluate', {
      expression: `
        new Promise((resolve) => {
          const img = new Image();
          img.src = 'data:image/png;base64,' + window.s25Base64;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Year buttons row:
            // Let's search across y from 350 to 550 for the year pills
            // Image width is 3840, height is 2214
            // The modal is centered horizontally. Modal left is approx 3840 * 0.23 = 880, modal right is approx 2960.
            const pills = [];
            for (let x = 950; x <= 1800; x += 100) {
              for (let y = 430; y <= 500; y += 10) {
                const p = ctx.getImageData(x, y, 1, 1).data;
                // If it's blue/indigo (e.g. b > 180 && r < 100)
                if (p[2] > 180 && p[0] < 100) {
                  pills.push({ x, y, rgba: Array.from(p) });
                }
              }
            }

            resolve({ pills: pills.slice(0, 30) });
          };
        })
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Result:', JSON.stringify(result.result.value, null, 2));
  } finally {
    chrome.kill();
  }
}
test().catch(console.error);
