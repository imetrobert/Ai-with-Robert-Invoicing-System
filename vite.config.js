import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: Change 'YOUR_REPO_NAME' to your actual GitHub repository name
// e.g., if your repo is github.com/robertsimon/invoicing → base: '/invoicing/'
export default defineConfig({
  plugins: [react()],
  base: '/Ai-with-Robert-Invoicing-System/',
})
