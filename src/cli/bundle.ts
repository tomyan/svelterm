/**
 * Pure helpers behind `svelterm build` — the parts that don't need
 * rolldown: code generation for the bundle and project-layout discovery.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'

export const GLOBAL_CSS_MODULE = '\0svelterm:global-css'
export const BOOTSTRAP_MODULE = '\0svelterm:bootstrap'
export const WS_STUB_MODULE = '\0svelterm:ws-stub'

/** Debug-server dependency, never active in bundles. */
export const WS_STUB_SOURCE = [
    'export default undefined',
    'export class WebSocketServer {}',
    'export class WebSocket {}',
    '',
].join('\n')

/**
 * Append a registration call so the compiled component carries its
 * extracted CSS into the bundle; run() collects it from the registry.
 */
export function withCssRegistration(compiledJs: string, css: string | null): string {
    if (!css) return compiledJs
    return compiledJs
        + `\nimport { registerComponentCss as __svelterm_registerCss } from '@svelterm/core/app'`
        + `\n__svelterm_registerCss(${JSON.stringify(css)})\n`
}

/**
 * The bundle's entry module: global CSS registers first (so component
 * styles land later in the cascade), then the app component mounts.
 */
export function bootstrapModule(entryPath: string, globalCss?: string): string {
    const lines = [`import { run } from '@svelterm/core/app'`]
    if (globalCss) lines.push(`import ${JSON.stringify('svelterm:global-css')}`)
    lines.push(
        `import App from ${JSON.stringify(entryPath)}`,
        `run(App, {})`,
        '',
    )
    return lines.join('\n')
}

/** The module registering the project's global stylesheet. */
export function globalCssModule(css: string): string {
    return `import { registerComponentCss } from '@svelterm/core/app'\n`
        + `registerComponentCss(${JSON.stringify(css)})\n`
}

const ENTRY_CANDIDATES = ['src/App.svelte', 'App.svelte']
const GLOBAL_CSS_CANDIDATES = ['src/main.css', 'main.css']

/** The conventional entry component, or null if none exists. */
export function findEntry(projectDir: string): string | null {
    return firstExisting(projectDir, ENTRY_CANDIDATES)
}

/** The conventional global stylesheet, or null if none exists. */
export function findGlobalCss(projectDir: string): string | null {
    return firstExisting(projectDir, GLOBAL_CSS_CANDIDATES)
}

function firstExisting(dir: string, candidates: string[]): string | null {
    for (const candidate of candidates) {
        const full = path.join(dir, candidate)
        if (existsSync(full)) return full
    }
    return null
}
