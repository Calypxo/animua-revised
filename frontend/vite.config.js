import { defineConfig } from 'vite';
import { existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { relative, resolve } from 'path';

const projectRoot = import.meta.dirname;

const DEFER_SHARED_CSS_PAGES = [
  'pages/public/find-furbabies.html',
  'pages/public/announcements.html',
  'pages/public/surrender.html',
];

const deferPublicSharedCss = () => ({
  name: 'defer-public-shared-css',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      const filename = ctx.filename?.replace(/\\/g, '/');

      if (!filename || !DEFER_SHARED_CSS_PAGES.some((page) => filename.endsWith(page))) return html;

      let nextHtml = html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/public-ui-[^"]+\.css)">/g,
        '<link rel="preload" as="style" crossorigin href="$1" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" crossorigin href="$1"></noscript>'
      );

      return nextHtml;
    },
  },
});

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
  plugins: [deferPublicSharedCss(), createPwaAssetManifest()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main:                    resolve(projectRoot, 'index.html'),
        home:                    resolve(projectRoot, 'pages/public/home.html'),
        findFurbabies:           resolve(projectRoot, 'pages/public/find-furbabies.html'),
        announcements:           resolve(projectRoot, 'pages/public/announcements.html'),
        petCompatibility:        resolve(projectRoot, 'pages/public/petCompatibility.html'),
        compatibilityResults:    resolve(projectRoot, 'pages/public/compatibilityResults.html'),
        quizLanding:             resolve(projectRoot, 'pages/public/quizLanding.html'),
        contact:                 resolve(projectRoot, 'pages/public/contact.html'),
        surrender:               resolve(projectRoot, 'pages/public/surrender.html'),
        mySubmissions:           resolve(projectRoot, 'pages/public/my-submissions.html'),
        verifyEmailAction:       resolve(projectRoot, 'pages/public/verify-email-action.html'),
        verifySuccess:           resolve(projectRoot, 'pages/public/verify-success.html'),
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
