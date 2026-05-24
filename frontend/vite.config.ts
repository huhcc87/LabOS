import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VitePWA removed: manifest and registration are self-managed.
// public/sw.js is served as-is (Vite copies public/ automatically).

export default defineConfig({
  plugins: [
    react(),
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // UI & charting
          'charts':       ['recharts'],
          // Rich text editor (large)
          'tiptap':       [
            '@tiptap/react', '@tiptap/core', '@tiptap/starter-kit',
            '@tiptap/extension-highlight', '@tiptap/extension-typography',
            '@tiptap/extension-underline', '@tiptap/extension-task-list',
            '@tiptap/extension-task-item', '@tiptap/extension-table',
            '@tiptap/extension-table-row', '@tiptap/extension-table-header',
            '@tiptap/extension-table-cell', '@tiptap/extension-link',
            '@tiptap/extension-image',
          ],
          // Document export (only loaded when user exports)
          'docx-export':  ['docx', 'file-saver'],
          'pdf-export':   ['jspdf', 'html2canvas'],
          // Protocol builder tools
          'protocol-lib': ['reactflow', 'react-qr-code', 'dexie'],
          // Barcode/QR scanner (large, only on scan pages)
          'scanner':      ['@zxing/browser', '@zxing/library'],
          // Barcode label generation (very large, only on label pages)
          'bwip':         ['bwip-js'],
          // Spreadsheet import/export
          'xlsx':         ['xlsx'],
          // Vendor (stable, long-cache)
          'vendor-http':  ['axios'],
          'vendor-ui':    ['react-hot-toast', 'react-dropzone', 'fuse.js'],
          'vendor-dates': ['date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
    },
  },
})
