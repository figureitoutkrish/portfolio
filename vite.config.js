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
  // robots.txt, and a sitemap once the site's address is known (it needs absolute URLs)
  generateBundle() {
    const pages = ['/', '/data/', '/creative/'];
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}` });
    if (!siteUrl) return;
    const urls = pages.map((p) => `  <url><loc>${siteUrl}${p}</loc></url>`).join('\n');
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
  },
});

// The W11 in src/assets/local/ is an unlicensed rip, and music in content/ has unknown rights: they
// may only ever run on Krish's Mac. Code asks for them through this virtual module, which finds it on the dev server and is always empty in a
// build, so no build (even one made on the Mac) can contain it.
const localModelsPlugin = () => {
  let build = false;
  return {
    name: 'local-models',
    configResolved: (c) => (build = c.command === 'build'),
    resolveId: (id) => (id === 'virtual:local-models' ? '\0local-models' : null),
    load(id) {
      if (id !== '\0local-models') return null;
      // (music Krish drops into content/ for the garage radio: same rule, rights unknown)
      if (build) return 'export default {};\nexport const music = {};';
      return "export default import.meta.glob('/src/assets/local/w11/*.{glb,png}', { query: '?url', import: 'default', eager: true });\nexport const music = import.meta.glob('/content/*.{mp3,m4a}', { query: '?url', import: 'default', eager: true });";
    },
  };
};

export default defineConfig({
  plugins: [siteUrlPlugin(), localModelsPlugin()],
  server: { open: true },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: page('./index.html'),
        data: page('./data/index.html'),
        creative: page('./creative/index.html'),
        notfound: page('./404.html'), // Vercel serves dist/404.html for any missing page
      },
    },
  },
});
