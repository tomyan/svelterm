// Browser build for the dual-target demo: the same App.svelte compiled
// as regular DOM Svelte (no customRenderer).
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    root: path.resolve(__dirname, 'demo/dual'),
    plugins: [svelte()],
    build: {
        outDir: path.resolve(__dirname, 'dist-demo/dual-web'),
        emptyOutDir: true,
    },
})
