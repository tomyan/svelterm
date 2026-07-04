#!/usr/bin/env node

/**
 * svelterm — the CLI. Subcommands:
 *
 *   svelterm init <dir>          scaffold a terminal app project
 *   svelterm dev <url>           run the app against a Vite dev server
 *   svelterm build [entry]       bundle into one self-contained .mjs
 */

const USAGE = `Usage:
  svelterm init <directory>
  svelterm dev <dev-server-url>[/path/to/App.svelte]
  svelterm build [entry.svelte] [-o out.mjs] [--css main.css]
  svelterm inspect <tree|query|style|box|console|raw> [args] [--port n]`

async function main(): Promise<void> {
    const [command, ...rest] = process.argv.slice(2)
    switch (command) {
        case 'init': {
            const { runInit } = await import('./init.js')
            runInit(rest)
            break
        }
        case 'dev': {
            const { runDev } = await import('./dev.js')
            await runDev(rest)
            break
        }
        case 'build': {
            const { runBuild } = await import('./build.js')
            await runBuild(rest)
            break
        }
        case 'inspect': {
            const { runSvt } = await import('./svt.js')
            await runSvt(rest)
            break
        }
        default:
            console.error(USAGE)
            process.exit(command === undefined || command === '--help' ? 0 : 1)
    }
}

main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
})
