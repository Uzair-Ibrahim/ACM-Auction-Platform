import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const indexHtml = path.join(distDir, 'index.html');

if (fs.existsSync(indexHtml)) {
  const routes = ['dashboard', 'captain', 'admin'];
  fs.copyFileSync(indexHtml, path.join(distDir, '404.html'));
  for (const route of routes) {
    fs.copyFileSync(indexHtml, path.join(distDir, `${route}.html`));
    const routeDir = path.join(distDir, route);
    fs.mkdirSync(routeDir, { recursive: true });
    fs.copyFileSync(indexHtml, path.join(routeDir, 'index.html'));
  }
  console.log('[postbuild] Generated static SPA entrypoints for /dashboard, /captain, /admin');
}
