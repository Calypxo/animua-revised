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

        // ── Management Pages ──────────────────────────────────
        adminLogin:        resolve(__dirname, 'pages/management/admin-login.html'),
        dashboard:         resolve(__dirname, 'pages/management/dashboard.html'),
        animalRecords:     resolve(__dirname, 'pages/management/animalRecords.html'),
        adoptions:         resolve(__dirname, 'pages/management/adoptions.html'),
        surrenders:        resolve(__dirname, 'pages/management/surrenders.html'),
        inventory:         resolve(__dirname, 'pages/management/inventory.html'),
        reports:           resolve(__dirname, 'pages/management/reports.html'),
        petCompatibility:  resolve(__dirname, 'pages/management/petCompatibility.html'),
        team:              resolve(__dirname, 'pages/management/team.html'),
        settings:          resolve(__dirname, 'pages/management/settings.html'),

        // ── Public Pages ──────────────────────────────────────
        home: resolve(__dirname, 'pages/public/home.html'),
      },
    },
  },

  // Treat the /public folder as static assets — copies everything as-is to dist
  // Put sidebar.js in /public/assets/js/sidebar.js as an alternative if needed
  publicDir: 'public',

  server: {
    host: true,
    port: 5173
  }
});