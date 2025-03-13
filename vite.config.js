// vite.config.js
import { defineConfig } from 'vite';
import vitePluginString from 'vite-plugin-string';

export default defineConfig({
  root: './',
  publicDir: 'assets',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  server: {
    open: true
  },
  plugins: [
    vitePluginString({
      include: '**/*.glsl',
    })
  ],
  assetsInclude: ['**/*.jpg', '**/*.png', '**/*.glb', '**/*.gltf']
}); 