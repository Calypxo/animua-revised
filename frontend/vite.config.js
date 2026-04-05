import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),

        adminLogin: resolve(__dirname, 'pages/admin-login.html'),
        dashboard: resolve(__dirname, 'pages/dashboard.html'),
        adoptionApplications: resolve(__dirname, 'pages/adoptionApplications.html'),
        animalProfile: resolve(__dirname, 'pages/animalProfile.html'),
        animalProfiling: resolve(__dirname, 'pages/animalProfiling.html'),
        animalRecords: resolve(__dirname, 'pages/animalRecords.html'),
        intake: resolve(__dirname, 'pages/intakeList.html'),
        inventory: resolve(__dirname, 'pages/inventory.html'),
        petCompatibility: resolve(__dirname, 'pages/petCompatibility.html'),
        reports: resolve(__dirname, 'pages/reports.html'),
        settings: resolve(__dirname, 'pages/settings.html'),
        surrenders: resolve(__dirname, 'pages/surrenders.html'),
        userManagement: resolve(__dirname, 'pages/userManagement.html'),
      },
    },
  },

  publicDir: 'public',

  server: {
    host: true,
    port: 5175
  }
});