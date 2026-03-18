import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.', // Look for index.html in the current directory
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // Main Entry
        main: resolve(__dirname, 'index.html'),
        // Management Pages
        dashboard: resolve(__dirname, 'pages/management/dashboard.html'),
        // Public Pages
        home: resolve(__dirname, 'pages/public/home.html'),
      },
    },
  },
  server: {
    host: true,
    port: 5173
  }
});