import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // ── Main Entry ────────────────────────────────────────
        main: resolve(__dirname, 'index.html'),

        // ── Public Pages ──────────────────────────────────────
        home: resolve(__dirname, 'pages/public/home.html'),
        findFurbabies: resolve(__dirname, 'pages/public/find-furbabies.html'),
        petCompatibility: resolve(__dirname, 'pages/public/petCompatibility.html'),
        quizLanding: resolve(__dirname, 'pages/public/quizLanding.html'),
        compatibilityResults: resolve(__dirname, 'pages/public/compatibilityResults.html'),
        contact: resolve(__dirname, 'pages/public/contact.html'),
        surrender: resolve(__dirname, 'pages/public/surrender.html'),
      },
    },
  },

  // public/ folder is copied to dist/ automatically — no plugin needed
  publicDir: 'public',

  server: {
    host: true,
    port: 5173
  }
});