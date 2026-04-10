import { defineConfig } from 'vite'
import { svelterm } from './src/vite/plugin.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [
        svelterm({
            entry: 'demo/counter/App.svelte',
        }),
    ],
    resolve: {
        alias: {
            '@svelterm/core': path.resolve(__dirname, 'src/renderer/default.ts'),
        },
    },
    ssr: {
        noExternal: ['svelte'],
    },
})
