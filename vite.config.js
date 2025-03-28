// vite.config.js
import { defineConfig } from 'vite';
import vitePluginString from 'vite-plugin-string';

export default defineConfig({
  root: './',
  base: '/TightropeWalker/',
  publicDir: 'assets',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'postprocessing': ['postprocessing']
        }
      }
    }
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