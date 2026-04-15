import puppeteer from 'file:///c:/Users/sande/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';

const dir = join(__dirname, 'temporary screenshots');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const existing = existsSync(dir) ? readdirSync(dir).filter(f => f.startsWith('screenshot-')).length : 0;
const filename = label
  ? `screenshot-${existing + 1}-${label}.png`
  : `screenshot-${existing + 1}.png`;
const filepath = join(dir, filename);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  executablePath: 'C:/Users/sande/.cache/puppeteer/chrome/win64-146.0.7680.153/chrome-win64/chrome.exe'
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2' });
await page.screenshot({ path: filepath, fullPage: false });
await browser.close();

console.log(`Screenshot saved: ${filepath}`);
