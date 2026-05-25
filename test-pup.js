const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Capture logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));
  
  await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle0' });
  
  // Fill the form
  await page.type('#email', 'pup@example.com');
  await page.type('#password', 'password123');
  await page.type('#confirm', 'password123');
  
  console.log('Clicking register button...');
  await page.click('#btn');
  
  await page.waitForTimeout(2000);
  
  const errText = await page.$eval('#errMsg', el => el.textContent).catch(e => '');
  const okText = await page.$eval('#okMsg', el => el.textContent).catch(e => '');
  console.log('Error banner:', errText);
  console.log('Success banner:', okText);
  
  console.log('Current URL:', page.url());
  
  await browser.close();
})();
