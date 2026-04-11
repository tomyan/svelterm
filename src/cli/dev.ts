#!/usr/bin/env node

/**
 * svelterm dev — tells a running Vite dev server to start the
 * terminal app.
 *
 * Usage:
 *   npx svelterm dev http://localhost:5173
 *   npx svelterm dev http://localhost:5173/src/App.svelte
 */

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

    // Determine entry point from URL path or default
    const entry = parsedUrl.pathname !== '/'
        ? parsedUrl.pathname
        : '/src/App.svelte'

    // Tell the server to start the terminal app
    const result = await fetchJson(`${baseUrl}/__svelterm/start?entry=${encodeURIComponent(entry)}`)
    if (!result?.ok) {
        console.error('Failed to start terminal app')
        process.exit(1)
    }

    console.log(`[svelterm] Started ${entry} — terminal app running on the Vite server`)
    console.log(`[svelterm] Press Ctrl+C to stop`)

    // Keep the CLI alive and handle stop on exit
    process.on('SIGINT', async () => {
        await fetchJson(`${baseUrl}/__svelterm/stop`)
        process.exit(0)
    })
    process.on('SIGTERM', async () => {
        await fetchJson(`${baseUrl}/__svelterm/stop`)
        process.exit(0)
    })

    // Keep process alive
    setInterval(() => {}, 60000)
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

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
