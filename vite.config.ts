import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Connect, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function localArtifacts(): Plugin {
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const files: Record<string, string> = {
      '/api/artifacts/manifest': 'manifest.json',
      '/api/artifacts/catalog': 'catalog.json',
    };
    const filename = files[req.url?.split('?')[0] ?? ''];
    if (!filename) return next();
    const path = resolve(process.cwd(), 'target', filename);
    try {
      await stat(path);
      res.setHeader('Content-Type', 'application/json');
      const stream = createReadStream(path);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (error) {
      res.statusCode = error instanceof Error && 'code' in error && error.code === 'ENOENT' ? 404 : 500;
      res.end(`Could not read ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  return {
    name: 'local-dbt-artifacts',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export default defineConfig({
  plugins: [react(), localArtifacts()],
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
});
