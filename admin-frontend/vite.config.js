import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),

        adminLogin:             resolve(__dirname, 'pages/admin-login.html'),
        dashboard:              resolve(__dirname, 'pages/dashboard.html'),
        animalProfile:          resolve(__dirname, 'pages/animalProfile.html'),
        animalProfiling:        resolve(__dirname, 'pages/animalProfiling.html'),
        adoptionApplications:   resolve(__dirname, 'pages/adoptionApplications.html'),
        surrenders:             resolve(__dirname, 'pages/surrenders.html'),
        inventory:              resolve(__dirname, 'pages/inventory.html'),
        reports:                resolve(__dirname, 'pages/reports.html'),
        petCompatibility:       resolve(__dirname, 'pages/petCompatibility.html'),
        userManagement:         resolve(__dirname, 'pages/userManagement.html'),
        intakeList:             resolve(__dirname, 'pages/intakeList.html'),
        postAdoption:           resolve(__dirname, 'pages/postAdoption.html'),
        auditTrail:             resolve(__dirname, 'pages/auditTrail.html'),
        archivedRecords:        resolve(__dirname, 'pages/archivedRecords.html'),
      },
    },
  },

  publicDir: 'public',

  server: {
    host: true,
    port: 5175,
  },
});