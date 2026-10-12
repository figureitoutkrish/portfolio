import { defineConfig } from 'vite';

// Multi-page site: each page is its own HTML entry (served at /, /data/, /creative/).
const page = (path) => new URL(path, import.meta.url).pathname;

// Share previews need absolute URLs. SITE_URL (set it once the domain exists) wins; on Vercel the
// production URL is used automatically; locally it falls back to relative paths.
const siteUrl = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
).replace(/\/$/, '');
const siteUrlPlugin = () => ({
  name: 'site-url',
  transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl),
});

export default defineConfig({
  plugins: [siteUrlPlugin()],
  server: { open: true },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: page('./index.html'),
        data: page('./data/index.html'),
        creative: page('./creative/index.html'),
      },
    },
  },
});
