#!/usr/bin/env node

/**
 * svelterm dev — connects to a Vite dev server and runs the
 * terminal app. The server compiles modules, this process
 * renders to the terminal.
 *
 * Usage:
 *   npx svelterm dev http://localhost:5173
 *   npx svelterm dev http://localhost:5173/src/App.svelte
 */

import { ModuleRunner, createWebSocketModuleRunnerTransport } from 'vite/module-runner'
import { WebSocket } from 'ws'
import http from 'http'

const args = process.argv.slice(2)
const command = args[0]

if (command !== 'dev') {
    console.error('Usage: svelterm dev <url>')
    process.exit(1)
}

const url = args[1]
if (!url) {
    console.error('Usage: svelterm dev http://localhost:5173')
    process.exit(1)
}

async function main() {
    const parsedUrl = new URL(url)
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`

    // Connect to the Vite server's terminal environment
    // The environment exposes a WebSocket for ModuleRunner at the HMR path
    const wsUrl = `ws://${parsedUrl.host}/__svelterm`
    const transport = createWebSocketModuleRunnerTransport({
        createConnection() {
            return new WebSocket(wsUrl) as any
        },
    })

    const runner = new ModuleRunner({ transport })

    // Determine entry point
    const entry = parsedUrl.pathname !== '/'
        ? parsedUrl.pathname
        : '/src/App.svelte'

    let cleanup: (() => void) | null = null

    try {
        // Import the component — this triggers compilation on the server
        const mod = await runner.import(entry)
        const Component = mod.default
        if (!Component) {
            console.error(`${entry} must default-export a Svelte component`)
            process.exit(1)
        }

        // Import svelterm's run function
        const sveltermMod = await runner.import('@svelterm/core/app')

        // Fetch CSS from the server — compiled on demand from .svelte sources
        const css = await fetchText(`${baseUrl}/__svelterm/css`) ?? ''

        cleanup = sveltermMod.run(Component, {
            css,
            fullscreen: true,
            mouse: true,
        })
    } catch (err) {
        console.error('[svelterm] Error:', err)
        process.exit(1)
    }

    process.on('SIGINT', () => {
        if (cleanup) cleanup()
        runner.close()
        process.exit(0)
    })
    process.on('SIGTERM', () => {
        if (cleanup) cleanup()
        runner.close()
        process.exit(0)
    })
}

function collectCssFromRunner(runner: ModuleRunner): string {
    const parts: string[] = []
    const mods = (runner as any).evaluatedModules
    console.error('[svelterm] evaluatedModules type:', typeof mods, mods ? Object.keys(mods) : 'null')
    if (mods) {
        const map = mods.idToModuleMap ?? mods.urlToIdMap
        console.error('[svelterm] map type:', typeof map, map?.size ?? 'no size')
        if (map) {
            for (const [id] of map) {
                if (id.includes('svelte') || id.includes('.css')) {
                    console.error('[svelterm] module:', id.substring(id.lastIndexOf('/') + 1))
                }
            }
        }
        for (const [id, mod] of map ?? []) {
            if (id.includes('type=style') || id.includes('lang.css')) {
                console.error('[svelterm] CSS module:', id.substring(id.lastIndexOf('/') + 1))
                console.error('[svelterm] exports:', mod.exports ? Object.keys(mod.exports) : 'none')
                console.error('[svelterm] default type:', typeof mod.exports?.default)
                console.error('[svelterm] default value:', String(mod.exports?.default)?.substring(0, 100))
                const css = mod.exports?.default
                if (typeof css === 'string' && css.length > 0) {
                    parts.push(css)
                }
            }
        }
    }
    return parts.join('\n')
}

function fetchText(url: string): Promise<string | null> {
    return new Promise((resolve) => {
        http.get(url, (res) => {
            let data = ''
            res.on('data', (chunk: string) => data += chunk)
            res.on('end', () => resolve(data))
        }).on('error', () => resolve(null))
    })
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
