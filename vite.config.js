import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/ncert-proxy': {
        target: 'https://ncert.nic.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ncert-proxy/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('ncert proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Bypass security hotlinking blockages by setting NCERT referrer headers
            proxyReq.setHeader('Referer', 'https://ncert.nic.in/');
            proxyReq.setHeader('Origin', 'https://ncert.nic.in');
          });
        }
      }
    }
  }
});
