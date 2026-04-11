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
        alias: [
            { find: '@svelterm/core/app', replacement: path.resolve(__dirname, 'src/index.ts') },
            { find: '@svelterm/core', replacement: path.resolve(__dirname, 'src/renderer/default.ts') },
        ],
    },
    optimizeDeps: {
        exclude: ['svelte'],
    },
    ssr: {
        noExternal: ['svelte'],
    },
})
