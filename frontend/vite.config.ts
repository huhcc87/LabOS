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
          'charts':      ['recharts'],
          'tiptap':      [
            '@tiptap/react', '@tiptap/core', '@tiptap/starter-kit',
            '@tiptap/extension-highlight', '@tiptap/extension-typography',
            '@tiptap/extension-underline', '@tiptap/extension-task-list',
            '@tiptap/extension-task-item', '@tiptap/extension-table',
            '@tiptap/extension-table-row', '@tiptap/extension-table-header',
            '@tiptap/extension-table-cell', '@tiptap/extension-link',
            '@tiptap/extension-image',
          ],
          'docx-export': ['docx', 'file-saver'],
          'pdf-export':  ['jspdf', 'html2canvas'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
    },
  },
})
