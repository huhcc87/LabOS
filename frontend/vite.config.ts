import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectRegister: false,       // we handle registration in main.tsx
      manifest: false,             // we have our own public/manifest.json
      injectManifest: {
        injectionPoint: undefined, // sw.js doesn't use workbox injection
      },
      devOptions: {
        enabled: false,            // use manual sw.js in dev
      },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', '@tiptap/core'],
  },
  optimizeDeps: {
    include: [
      'docx', 'file-saver',
      'recharts',
      '@tiptap/react', '@tiptap/starter-kit',
      '@tiptap/extension-highlight', '@tiptap/extension-typography',
      '@tiptap/extension-underline', '@tiptap/extension-task-list',
      '@tiptap/extension-task-item', '@tiptap/extension-table',
      '@tiptap/extension-table-row', '@tiptap/extension-table-header',
      '@tiptap/extension-table-cell', '@tiptap/extension-link',
      '@tiptap/extension-image',
    ],
    exclude: [],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    },
  },
})
