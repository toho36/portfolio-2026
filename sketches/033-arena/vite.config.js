import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { cpSync } from 'node:fs';
const outDir = '/Users/vitek/Documents/agent-runs/portfolio-2026/2026-10-15-hero-brainstorm/arena/goalloop/build';
export default defineConfig({
 root: fileURLToPath(new URL('.', import.meta.url)), base: './',
 publicDir: false,
 plugins: [{ name: 'arena-media', closeBundle() { cpSync(fileURLToPath(new URL('./media', import.meta.url)), `${outDir}/media`, { recursive: true }); } }],
 server: { host: '127.0.0.1', port: 5208, strictPort: true },
 preview: { host: '127.0.0.1', port: 5208, strictPort: true },
 build: { outDir, emptyOutDir: true, target: 'es2022' },
});
