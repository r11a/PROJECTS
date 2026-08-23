import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';

export default defineConfig({
  // Home Assistant Ingress serves the app below a dynamic URL prefix.
  // Relative asset paths keep the same build valid for both Ingress and
  // the standalone host port.
  base: './',
  plugins: [react(), { name:'projects-pwa-icon', closeBundle(){ copyFileSync('icon.png','dist/icon.png'); } }],
  build: { sourcemap: true },
});
