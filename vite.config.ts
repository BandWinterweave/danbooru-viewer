import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.json';

const apiTargets: Record<string, string> = {
  danbooru: 'https://danbooru.donmai.us',
  gelbooru: 'https://gelbooru.com',
  safebooru: 'https://safebooru.org',
  yandere: 'https://yande.re',
  rule34: 'https://api.rule34.xxx',
};

function developmentApiProxy(): Plugin {
  return {
    name: 'development-api-proxy',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.startsWith('/__image?')) {
          try {
            const url = new URL(request.url, 'http://localhost').searchParams.get('url');
            if (!url) throw new Error('Missing image URL');
            const imageUrl = new URL(url);
            const allowed = ['donmai.us', 'safebooru.org', 'gelbooru.com', 'yande.re', 'rule34.xxx'].some(
              (host) => imageUrl.hostname === host || imageUrl.hostname.endsWith(`.${host}`),
            );
            if (imageUrl.protocol !== 'https:' || !allowed) {
              response.statusCode = 403;
              response.end('Image host is not allowed');
              return;
            }
            const headers: Record<string, string> = { Accept: 'image/*', 'User-Agent': 'Danbooru Viewer/0.1' };
            if (request.headers.range) headers.Range = request.headers.range;
            if (imageUrl.hostname.endsWith('.gelbooru.com')) headers.Referer = 'https://gelbooru.com/';
            const upstream = await fetch(imageUrl, { headers });
            response.statusCode = upstream.status;
            for (const name of [
              'content-type',
              'content-length',
              'content-range',
              'accept-ranges',
              'cache-control',
              'etag',
            ]) {
              const value = upstream.headers.get(name);
              if (value) response.setHeader(name, value);
            }
            if (!upstream.body) {
              response.end();
              return;
            }
            const reader = upstream.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              response.write(Buffer.from(value));
            }
            response.end();
          } catch (error) {
            response.statusCode = 502;
            response.end(error instanceof Error ? error.message : 'Image proxy failed');
          }
          return;
        }
        const match = request.url?.match(/^\/__api\/([^/]+)(\/.*)$/);
        if (!match) {
          next();
          return;
        }
        const target = apiTargets[match[1]];
        if (!target) {
          response.statusCode = 403;
          response.end('Unknown API source');
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const headers = new Headers({ Accept: 'application/json', 'User-Agent': 'Danbooru Viewer/0.1' });
          for (const name of ['authorization', 'content-type']) {
            const value = request.headers[name];
            if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
          }
          const upstream = await fetch(`${target}${match[2]}`, {
            method: request.method,
            headers,
            body,
            redirect: 'follow',
          });
          response.statusCode = upstream.status;
          upstream.headers.forEach((value, name) => {
            if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(name))
              response.setHeader(name, value);
          });
          response.end(Buffer.from(await upstream.arrayBuffer()));
        } catch (error) {
          response.statusCode = 502;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Development proxy failed' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const firefox = mode === 'firefox';
  const development = mode === 'development' || mode === 'e2e';
  const appPlugins = [developmentApiProxy(), react()];
  return {
    plugins:
      mode === 'test'
        ? []
        : mode === 'e2e'
          ? appPlugins
          : [
              ...appPlugins,
              crx({
                manifest: {
                  ...manifest,
                  manifest_version: 3 as const,
                  permissions: manifest.permissions as chrome.runtime.ManifestPermissions[],
                  background: { ...manifest.background, type: 'module' as const },
                },
              }),
            ],
    build: {
      outDir: development ? 'dist-dev' : firefox ? 'dist-firefox' : 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            state: ['zustand', 'idb-keyval'],
            virtual: ['@tanstack/react-virtual'],
          },
        },
      },
    },
    server: {
      open: '/src/newtab/index.html',
    },
    test: {
      include: ['./tests/unit/**/*.{test,spec}.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary', 'html'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.d.ts', 'src/**/main.tsx'],
        thresholds: {
          lines: 25,
          functions: 25,
          branches: 25,
          statements: 25,
        },
      },
    },
  };
});
