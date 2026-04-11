import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelterm } from './src/vite/config.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demo = process.env.DEMO ?? 'counter'

export default defineConfig({
    root: path.resolve(__dirname, `demo/${demo}`),
    plugins: [
        svelte(svelterm.svelteOptions()),
        ...svelterm.terminalServer(),
    ],
    environments: svelterm.environments(),
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
