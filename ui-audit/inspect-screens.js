import { launchChrome, createPage } from './cdp.js';
import fs from 'node:fs';

async function test() {
  const chrome = await launchChrome();
  try {
    const { cdp } = await createPage('about:blank');
    const s26Base64 = fs.readFileSync('new_ui/Screen 26.png').toString('base64');
    const s25Base64 = fs.readFileSync('new_ui/Screen 25.png').toString('base64');

    await cdp.send('Runtime.evaluate', {
      expression: `
        window.s26Base64 = '${s26Base64}';
        window.s25Base64 = '${s25Base64}';
      `
    });

    const result = await cdp.send('Runtime.evaluate', {
      expression: `
        new Promise((resolve) => {
          const img26 = new Image();
          img26.src = 'data:image/png;base64,' + window.s26Base64;
          img26.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img26.width;
            canvas.height = img26.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img26, 0, 0);

            // Sample around CSE-B (middle section card)
            const samples = [];
            for (let y = 300; y <= 500; y += 20) {
              const pixel = ctx.getImageData(360, y, 1, 1).data;
              samples.push({ y, rgba: Array.from(pixel) });
            }

            // Also sample the Promote button in Screen 26
            const btnSamples = [];
            for (let x = 500; x <= 650; x += 30) {
              for (let y = 580; y <= 620; y += 10) {
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                btnSamples.push({ x, y, rgba: Array.from(pixel) });
              }
            }

            resolve({ samples, btnSamples });
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
