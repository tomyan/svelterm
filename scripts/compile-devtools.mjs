/**
 * Compile the built-in DevTools component with the fork compiler so
 * `svelterm devtools` can import and run it without a build step in the
 * user's project. Emits dist/devtools/DevTools.compiled.js (the client
 * component, importing @svelterm/core + svelte at runtime) and a sibling
 * .css.js exporting the extracted stylesheet.
 *
 * Runs after tsc. If the fork compiler isn't reachable (a consumer's
 * fresh checkout), the committed output is used as-is.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'src/devtools/DevTools.svelte')
const outDir = path.join(root, 'dist/src/devtools')
const compilerPath = path.resolve(root, '../svelte-fork/packages/svelte/compiler/index.js')

if (!existsSync(compilerPath)) {
    console.log('[devtools] fork compiler not found; keeping committed output')
    process.exit(0)
}

const compilerModule = await import(pathToFileURL(compilerPath).href)
const { compile } = compilerModule.default ?? compilerModule

const result = compile(readFileSync(source, 'utf8'), {
    generate: 'client',
    css: 'external',
    filename: 'DevTools.svelte',
    experimental: { customRenderer: '@svelterm/core' },
})

mkdirSync(outDir, { recursive: true })
writeFileSync(path.join(outDir, 'DevTools.compiled.js'), result.js.code)
writeFileSync(
    path.join(outDir, 'DevTools.css.js'),
    `export const css = ${JSON.stringify(result.css?.code ?? '')}\n`,
)
console.log('[devtools] compiled DevTools.svelte')
