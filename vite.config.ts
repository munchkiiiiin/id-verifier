import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Offline ID Verifier',
          short_name: 'ID Verifier',
          description: 'Secure Offline Employee ID Verification',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          // Icons were removed because the image files are not present in the
          // repository (they caused 404s in production). If you want PWA icons,
          // add `pwa-192x192.png` and `pwa-512x512.png` to the project root or
          // `public/` and restore these entries.
          icons: []
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify-file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
