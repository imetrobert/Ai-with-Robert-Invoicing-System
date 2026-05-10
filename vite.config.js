import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When deployed to a custom domain, use base: '/'
// When deployed to GitHub Pages subfolder, use base: '/repo-name/'
export default defineConfig({
  plugins: [react()],
  base: '/',
})
