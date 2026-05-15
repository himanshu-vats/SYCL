import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Serve /admin and /*/admin as admin.html, mirroring vercel.json rewrites
    {
      name: 'admin-html',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/admin' || req.url === '/admin.html' || /^\/[^/]+\/admin$/.test(req.url)) {
            const adminPath = path.resolve(__dirname, 'public/admin.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(fs.readFileSync(adminPath));
            return;
          }
          next();
        });
      },
    },
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
