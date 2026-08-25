import { defineConfig } from 'vite';
import { existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { relative, resolve } from 'path';

const projectRoot = import.meta.dirname;

const createPwaAssetManifest = () => ({
  name: 'create-pwa-asset-manifest',
  closeBundle() {
    const distDir = resolve(projectRoot, 'dist');
    const assetsDir = resolve(distDir, 'assets');
    if (!existsSync(assetsDir)) return;

    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const fullPath = resolve(dir, entry);
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
        } else {
          files.push(`/${relative(distDir, fullPath).replace(/\\/g, '/')}`);
        }
      }
    };

    walk(assetsDir);
    writeFileSync(
      resolve(distDir, 'pwa-assets.json'),
      `${JSON.stringify(files.sort(), null, 2)}\n`
    );
  },
});

export default defineConfig({
  root: '.',
  plugins: [createPwaAssetManifest()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(projectRoot, 'index.html'),

        adminLogin:             resolve(projectRoot, 'pages/admin-login.html'),
        dashboard:              resolve(projectRoot, 'pages/dashboard.html'),
        animalProfile:          resolve(projectRoot, 'pages/animalProfile.html'),
        animalProfiling:        resolve(projectRoot, 'pages/animalProfiling.html'),
        adoptionApplications:   resolve(projectRoot, 'pages/adoptionApplications.html'),
        surrenders:             resolve(projectRoot, 'pages/surrenders.html'),
        inventory:              resolve(projectRoot, 'pages/inventory.html'),
        reports:                resolve(projectRoot, 'pages/reports.html'),
        userManagement:         resolve(projectRoot, 'pages/userManagement.html'),
        intakeList:             resolve(projectRoot, 'pages/intakeList.html'),
        auditTrail:             resolve(projectRoot, 'pages/auditTrail.html'),
        archivedRecords:        resolve(projectRoot, 'pages/archivedRecords.html'),
        announcements:          resolve(projectRoot, 'pages/announcements.html'),
        contactMessages:        resolve(projectRoot, 'pages/contactMessages.html'),
        contactConversation:    resolve(projectRoot, 'pages/contactConversation.html'),
        accountSettings:         resolve(projectRoot, 'pages/accountSettings.html'),
        compatibilityQuiz:       resolve(projectRoot, 'pages/compatibilityQuiz.html'),
      },
    },
  },

  publicDir: 'public',

  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
  },
});
