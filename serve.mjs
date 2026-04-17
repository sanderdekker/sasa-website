import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const distDir = join(__dirname, 'dist');

const server = createServer(async (req, res) => {
  // Strip query string
  const pathname = req.url.split('?')[0];

  // Candidates to try in order
  const candidates = [
    join(distDir, pathname),                      // exact file
    join(distDir, pathname, 'index.html'),        // directory index (Astro routes)
    join(distDir, pathname.replace(/\/$/, ''), 'index.html'),
  ];

  for (const filePath of candidates) {
    const ext = extname(filePath).toLowerCase() || '.html';
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    try {
      const content = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    } catch { /* try next */ }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
