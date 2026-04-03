import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [
        svelte({
            compilerOptions: {
                experimental: {
                    customRenderer: 'svelterm',
                },
                css: 'external',
            },
        }),
    ],
    resolve: {
        alias: {
            'svelterm': path.resolve(__dirname, 'src/renderer/default.ts'),
        },
    },
    build: {
        target: 'node22',
        outDir: 'dist-demo',
        lib: {
            entry: 'demo/main.ts',
            formats: ['es'],
            fileName: 'main',
        },
        rollupOptions: {
            external: ['svelte', 'svelte/renderer', 'svelte/internal', 'svelte/internal/client', 'node:module', 'fs', 'url', 'path'],
        },
    },
})
