import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  build: {
    outDir: '../../ragemp-srv/client_packages/santosrp/ui',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // CEF için tek dosya — iife format: type="module" olmadan yüklenir
        // RAGE:MP CEF, package:// protokolünden ES module yükleyemiyor
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'index.js',
        assetFileNames: 'index.[ext]',
      },
    },
    modulePreload: { polyfill: false },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
