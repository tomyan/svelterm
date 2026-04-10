import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelterm } from './src/vite/plugin.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [
        svelte({
            // Use svelterm.compileOptions() for per-environment compilation
            // This requires the vite-plugin-svelte fork with environment support
            ...svelterm.compileOptions(),
        }),
        ...svelterm(),
    ],
    resolve: {
        alias: {
            '@svelterm/core': path.resolve(__dirname, 'src/renderer/default.ts'),
            '@svelterm/core/app': path.resolve(__dirname, 'src/index.ts'),
        },
    },
})
