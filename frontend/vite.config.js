import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        petCompatibility: resolve(__dirname, 'pages/public/petCompatibility.html'),
      },
    },
  },

  publicDir: 'public',

  server: {
    host: true,
    port: 5175
  }
});