import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'SeatSwap – Indian Railway Seat Finder',
        short_name: 'SeatSwap',
        description: 'Discover seat swap opportunities on Indian Railways',
        theme_color: '#1D9E75',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache API responses for offline resilience
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/payments\/config/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-config', expiration: { maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  server: {
  port: 5173,
  proxy: {
    '/api': { 
      target: process.env.VITE_API_URL ?? 'http://localhost:3001', 
      changeOrigin: true 
    },
  },
},
});
