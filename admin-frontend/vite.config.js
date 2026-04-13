import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // Main Entry - Admin Login
        main: resolve(__dirname, 'index.html'),

        // Management Pages
        dashboard:              resolve(__dirname, 'pages/dashboard.html'),
        animalRecords:          resolve(__dirname, 'pages/animalRecords.html'),
        adoptionRequests:       resolve(__dirname, 'pages/adoptionRequests.html'),
        surrenders:             resolve(__dirname, 'pages/surrenders.html'),
        inventory:              resolve(__dirname, 'pages/inventory.html'),
        reports:                resolve(__dirname, 'pages/reports.html'),
        petCompatibility:       resolve(__dirname, 'pages/petCompatibility.html'),
        team:                   resolve(__dirname, 'pages/team.html'),
        settings:               resolve(__dirname, 'pages/settings.html'),
        userManagement:         resolve(__dirname, 'pages/userManagement.html'),
        intake:                 resolve(__dirname, 'pages/intakeList.html'),
        adoptionApplications:   resolve(__dirname, 'pages/adoptionApplications.html'),
        postAdoption:           resolve(__dirname, "pages/postAdoption.html"),
        auditTrail:             resolve(__dirname, "pages/auditTrail.html"),
        archivedRecords:        resolve(__dirname, "pages/archivedRecords.html"),
      },
    },
  },

  publicDir: 'public',

  server: {
    host: true,
    port: 5175  // Different port for admin
  }
});