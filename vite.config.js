import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist', // Ensure Vite puts files here
  },
  server: {
    port: 5173,
    strictPort: true
  }
});