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

    const wsUrl = `ws://${parsedUrl.host}/__svelterm`
    const transport = createWebSocketModuleRunnerTransport({
        createConnection() {
            return new WebSocket(wsUrl) as any
        },
    })

    const runner = new ModuleRunner({ transport })

    const entry = parsedUrl.pathname !== '/'
        ? parsedUrl.pathname
        : '/src/App.svelte'

    let cleanup: (() => void) | null = null

    try {
        const mod = await runner.import(entry)
        const Component = mod.default
        if (!Component) {
            console.error(`${entry} must default-export a Svelte component`)
            process.exit(1)
        }

        const sveltermMod = await runner.import('@svelterm/core/app')
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
