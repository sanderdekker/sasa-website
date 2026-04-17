import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { execSync } from 'child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';

// Auto-detect Chrome — tries Puppeteer cache first, then system Chrome
function findChrome() {
  const home = homedir();
  const candidates = [
    // Puppeteer-downloaded Chrome (any version) for current user
    ...(() => {
      try {
        const base = join(home, '.cache', 'puppeteer', 'chrome');
        if (!existsSync(base)) return [];
        return readdirSync(base).map(v =>
          join(base, v, 'chrome-win64', 'chrome.exe')
        );
      } catch { return []; }
    })(),
    // System Chrome
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    'Chrome niet gevonden. Installeer Chrome of run: npx puppeteer browsers install chrome'
  );
}

const dir = join(__dirname, 'temporary screenshots');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const existing = readdirSync(dir).filter(f => f.startsWith('screenshot-')).length;
const filename = label
  ? `screenshot-${existing + 1}-${label}.png`
  : `screenshot-${existing + 1}.png`;
const filepath = join(dir, filename);

const executablePath = findChrome();
const browser = await puppeteer.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2' });
await page.screenshot({ path: filepath, fullPage: true });
await browser.close();

console.log(`Screenshot saved: ${filepath}`);
