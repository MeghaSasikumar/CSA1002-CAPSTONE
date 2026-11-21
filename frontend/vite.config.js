import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In Docker the API is reachable at http://backend:5000; the proxy avoids CORS issues.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': process.env.API_URL || 'http://backend:5000' },
    watch: { usePolling: true }, // needed for hot reload on Windows + Docker
  },
});
