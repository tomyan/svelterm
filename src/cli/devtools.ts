/**
 * svelterm devtools — launch the DevTools TUI, a svelterm app that
 * connects to a running app's debug server and inspects its live tree,
 * styles, and layout.
 *
 *   svelterm devtools            # connect on 9444
 *   svelterm devtools --port 9500
 */

import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

export async function runDevtools(argv: string[]): Promise<void> {
    const port = extractPort(argv)
    const here = path.dirname(fileURLToPath(import.meta.url))
    const compiledPath = path.resolve(here, '../devtools/DevTools.compiled.js')
    const cssPath = path.resolve(here, '../devtools/DevTools.css.js')

    let DevTools: any
    let css = ''
    try {
        DevTools = (await import(pathToFileURL(compiledPath).href)).default
        css = (await import(pathToFileURL(cssPath).href)).css ?? ''
    } catch {
        console.error('DevTools component is not compiled. Reinstall @svelterm/core.')
        process.exit(1)
    }

    // Import run() the same way a consumer's app does, so the renderer
    // instance matches the compiled component's.
    const require = createRequire(path.join(process.cwd(), 'package.json'))
    let run: any
    try {
        run = require('@svelterm/core/app').run
    } catch {
        const mod = await import('../index.js')
        run = mod.run
    }

    run(DevTools, { css, props: { port } })
}

function extractPort(argv: string[]): number {
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--port') return Number(argv[i + 1]) || 9444
    }
    return 9444
}
