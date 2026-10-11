import { defineConfig } from 'vite';

// Multi-page site: each page is its own HTML entry (served at /, /data/, /creative/).
const page = (path) => new URL(path, import.meta.url).pathname;

export default defineConfig({
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
