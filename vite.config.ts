import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const demo = process.env.DEMO ?? 'counter'

export default defineConfig({
    plugins: [
        svelte({
            compilerOptions: {
                experimental: {
                    customRenderer: '@svelterm/core',
                },
                css: 'external',
            },
        }),
    ],
    resolve: {
        alias: {
            '@svelterm/core': path.resolve(__dirname, 'src/renderer/default.ts'),
        },
        // Node resolves the bare `svelte` entry to the SERVER build
        // (exports "." default -> index-server.js), where onMount and
        // friends are silent no-ops — while `svelte/internal/client` is
        // explicitly the client runtime. Until the upstream
        // custom-renderer export condition lands, bundle the client
        // entries coherently instead of externalizing them.
        conditions: ['browser', 'import', 'module', 'default'],
    },
    build: {
        target: 'node22',
        outDir: `dist-demo/${demo}`,
        lib: {
            entry: `demo/${demo}/main.ts`,
            formats: ['es'],
            fileName: 'main',
        },
        rollupOptions: {
            external: ['node:module', 'fs', 'url', 'path', 'ws', 'http', 'crypto', 'child_process',
                'node:fs', 'node:fs/promises', 'node:tty', 'node:child_process', 'node:os', 'node:path', 'node:url', 'node-pty', 'module'],
        },
    },
})
