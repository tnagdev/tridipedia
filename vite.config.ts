import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

/**
 * Dev-only capture sink. Lets a page POST a data-URL frame straight to disk so
 * renders can be eyeballed without round-tripping base64 through a console.
 * Never runs in a production build.
 */
function captureSink() {
  return {
    name: 'capture-sink',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/__capture', (req: any, res: any) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
        let body = '';
        req.on('data', (c: any) => (body += c));
        req.on('end', () => {
          try {
            const { name, dataUrl } = JSON.parse(body);
            const safe = String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
            const b64 = String(dataUrl).split(',')[1] ?? '';
            mkdirSync('.captures', { recursive: true });
            writeFileSync(`.captures/${safe}`, Buffer.from(b64, 'base64'));
            res.end(JSON.stringify({ ok: true, path: `.captures/${safe}` }));
          } catch (e: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), captureSink()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // Force a single copy of three. Duplicates break instanceof checks across
    // drei / postprocessing / troika and produce very confusing runtime bugs.
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', 'postprocessing', 'troika-three-text'],
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        bench: fileURLToPath(new URL('./bench.html', import.meta.url)),
      },
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
