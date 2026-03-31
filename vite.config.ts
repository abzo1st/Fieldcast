import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Browser → OpenWeather is often blocked by CORS. Proxy through Vite so requests are same-origin in dev/preview.
  server: {
    watch: {
      ignored: ['**/vite.config.ts', '**/vite.config.js'],
    },
    proxy: {
      '/__ow': {
        target: 'https://api.openweathermap.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/__ow/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/__ow': {
        target: 'https://api.openweathermap.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/__ow/, ''),
      },
    },
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
