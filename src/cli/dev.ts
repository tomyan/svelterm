#!/usr/bin/env node

/**
 * svelterm dev — connects to a Vite dev server and renders the
 * terminal app with HMR.
 *
 * Usage:
 *   npx svelterm dev http://localhost:5173
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

    // Verify svelterm plugin is configured
    const config = await fetchJson(`${baseUrl}/__svelterm`)
    if (!config || config.version !== 1) {
        console.error('svelterm plugin not found on the Vite server.')
        console.error('Add svelterm() to your vite.config.ts plugins.')
        process.exit(1)
    }

    // Create WebSocket transport connecting to the terminal environment
    const wsUrl = `ws://${parsedUrl.host}/__svelterm/terminal`
    const transport = createWebSocketModuleRunnerTransport({
        createConnection() {
            const ws = new WebSocket(wsUrl) as any
            return ws
        },
    })

    const runner = new ModuleRunner({
        transport,
    })

    // Determine entry point
    const entryPath = parsedUrl.pathname !== '/'
        ? parsedUrl.pathname
        : '/src/App.svelte'

    let cleanup: (() => void) | null = null

    async function startApp() {
        if (cleanup) {
            try { cleanup() } catch {}
            cleanup = null
        }

        try {
            const mod = await runner.import(entryPath)
            const Component = mod.default

            if (!Component) {
                console.error(`[svelterm] ${entryPath} must default-export a Svelte component`)
                return
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
        }
    }

    await startApp()

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

function fetchJson(url: string): Promise<any> {
    return new Promise((resolve) => {
        http.get(url, (res) => {
            let data = ''
            res.on('data', (chunk: string) => data += chunk)
            res.on('end', () => {
                try { resolve(JSON.parse(data)) }
                catch { resolve(null) }
            })
        }).on('error', () => resolve(null))
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
