import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Lives in demo/ (run via `vite demo`) so Vitest — which auto-loads a root
// vite.config — never inherits the demo's React plugin or root.
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

export default defineConfig({
   plugins: [react()],
   // Consume the library exactly as an app would, but resolved to source for HMR.
   resolve: {
      alias: {
         'react-piqua-color/style.css': resolve(root, 'src/styles.css'),
         'react-piqua-color': resolve(root, 'src/index.ts'),
      },
   },
   server: { fs: { allow: [root] } },
})
