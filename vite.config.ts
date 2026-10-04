import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // ekspos ke 0.0.0.0 agar dapat diakses dari jaringan lokal (LAN/Wi-Fi)
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
