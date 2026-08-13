import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main:                    resolve(__dirname, 'index.html'),
        home:                    resolve(__dirname, 'pages/public/home.html'),
        findFurbabies:           resolve(__dirname, 'pages/public/find-furbabies.html'),
        announcements:           resolve(__dirname, 'pages/public/announcements.html'),
        petCompatibility:        resolve(__dirname, 'pages/public/petCompatibility.html'),
        compatibilityResults:    resolve(__dirname, 'pages/public/compatibilityResults.html'),
        quizLanding:             resolve(__dirname, 'pages/public/quizLanding.html'),
        contact:                 resolve(__dirname, 'pages/public/contact.html'),
        surrender:               resolve(__dirname, 'pages/public/surrender.html'),
        mySubmissions:           resolve(__dirname, 'pages/public/my-submissions.html'),
        verifyEmailAction:       resolve(__dirname, 'pages/public/verify-email-action.html'),
        verifySuccess:           resolve(__dirname, 'pages/public/verify-success.html'),
      },
    },
  },

  publicDir: 'public',

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
