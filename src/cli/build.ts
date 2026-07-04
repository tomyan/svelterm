/**
 * svelterm build — bundle a terminal app into one self-contained .mjs
 * that any Node runtime can execute directly:
 *
 *   svelterm build                  # src/App.svelte → dist/app.mjs
 *   svelterm build src/App.svelte -o dist/app.mjs
 *
 * Components compile with the project's Svelte (the custom-renderer
 * fork) targeting @svelterm/core; each carries its extracted CSS via
 * registerComponentCss. Requires rolldown (a dependency of vite 8 —
 * `npm i -D rolldown` if resolution fails).
 */

import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import {
    withCssRegistration, bootstrapModule, globalCssModule,
    findEntry, findGlobalCss,
    BOOTSTRAP_MODULE, GLOBAL_CSS_MODULE, WS_STUB_MODULE, WS_STUB_SOURCE,
} from './bundle.js'

interface BuildArgs {
    entry: string | null
    out: string | null
    css: string | null
}

export async function runBuild(argv: string[]): Promise<void> {
    const args = parseArgs(argv)
    const projectDir = process.cwd()

    const entry = args.entry ? path.resolve(args.entry) : findEntry(projectDir)
    if (!entry) {
        console.error('No entry component found (looked for src/App.svelte, App.svelte).')
        console.error('Usage: svelterm build [entry.svelte] [-o out.mjs] [--css main.css]')
        process.exit(1)
    }
    const cssPath = args.css ? path.resolve(args.css) : findGlobalCss(projectDir)
    const globalCss = cssPath ? readFileSync(cssPath, 'utf8') : ''
    const out = path.resolve(args.out ?? path.join('dist', 'app.mjs'))

    const [{ rolldown }, { compile }] = await Promise.all([
        importOrExplain('rolldown', 'rolldown bundles the app — npm i -D rolldown'),
        importOrExplain('svelte/compiler', 'svelte must be installed (the custom-renderer fork)'),
    ])

    const bundle = await rolldown({
        input: BOOTSTRAP_MODULE,
        platform: 'node',
        plugins: [sveltermPlugin(compile, entry, globalCss)],
        onwarn(warning: any, warn: (w: any) => void) {
            if (warning.code === 'UNRESOLVED_IMPORT') throw new Error(warning.message)
            warn(warning)
        },
    })
    mkdirSync(path.dirname(out), { recursive: true })
    await bundle.write({ format: 'esm', file: out, codeSplitting: false })
    await bundle.close()
    console.log(`built ${path.relative(projectDir, out)}`)
    console.log(`run it: node ${path.relative(projectDir, out)}`)
}

/** Compile .svelte modules and serve the bundle's virtual modules. */
function sveltermPlugin(compile: any, entry: string, globalCss: string) {
    // Component libraries installed as symlinks (file:/link: deps) resolve
    // imports from their real path, where the app's dependencies aren't
    // visible — pin the renderer packages to this project's installation.
    const requireFromProject = createRequire(path.join(process.cwd(), 'package.json'))
    const PINNED = ['@svelterm/core', 'svelte']
    return {
        name: 'svelterm',
        resolveId(id: string) {
            if (id === BOOTSTRAP_MODULE || id === 'svelterm:global-css' || id === 'ws') {
                return id === 'ws' ? WS_STUB_MODULE
                    : id === BOOTSTRAP_MODULE ? BOOTSTRAP_MODULE : GLOBAL_CSS_MODULE
            }
            if (PINNED.some(pkg => id === pkg || id.startsWith(`${pkg}/`))) {
                try {
                    return requireFromProject.resolve(id)
                } catch {
                    return null
                }
            }
            return null
        },
        load(id: string) {
            if (id === BOOTSTRAP_MODULE) return bootstrapModule(entry, globalCss)
            if (id === GLOBAL_CSS_MODULE) return globalCssModule(globalCss)
            if (id === WS_STUB_MODULE) return WS_STUB_SOURCE
            return null
        },
        transform(code: string, id: string) {
            if (!id.endsWith('.svelte')) return null
            const compiled = compile(code, {
                generate: 'client',
                css: 'external',
                filename: id,
                experimental: { customRenderer: '@svelterm/core' },
            })
            return {
                code: withCssRegistration(compiled.js.code, compiled.css?.code ?? null),
                map: null,
            }
        },
    }
}

async function importOrExplain(specifier: string, hint: string): Promise<any> {
    try {
        return await import(specifier)
    } catch {
        console.error(`Cannot resolve '${specifier}'. ${hint}`)
        process.exit(1)
    }
}

function parseArgs(argv: string[]): BuildArgs {
    const args: BuildArgs = { entry: null, out: null, css: null }
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === '-o' || arg === '--out') args.out = argv[++i] ?? null
        else if (arg === '--css') args.css = argv[++i] ?? null
        else if (!arg.startsWith('-')) args.entry = arg
    }
    return args
}
