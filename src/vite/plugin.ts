/**
 * Vite plugin for svelterm terminal rendering with HMR.
 *
 * The core problem: vite-plugin-svelte compiles .svelte files as
 * 'server' for SSR, but svelterm needs 'client' code running in Node.
 *
 * Solution: we don't use vite-plugin-svelte at all. Instead, we
 * compile .svelte files ourselves with the fork's compiler using
 * generate: 'client' and customRenderer.
 *
 * Usage:
 *   import { svelterm } from '@svelterm/core/vite'
 *
 *   export default defineConfig({
 *       plugins: [svelterm({ entry: 'src/App.svelte' })]
 *   })
 *
 * Note: do NOT include vite-plugin-svelte — this plugin replaces it.
 */

import type { Plugin, ViteDevServer } from 'vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

export interface SveltermPluginOptions {
    entry: string
    fullscreen?: boolean
    mouse?: boolean
    debug?: boolean
    debugPort?: number
}

export function svelterm(options: SveltermPluginOptions): Plugin[] {
    let server: ViteDevServer
    let cleanup: (() => void) | null = null
    let restartTimer: ReturnType<typeof setTimeout> | null = null
    const entryPath = path.resolve(options.entry)
    let compilerModule: any = null
    const cssMap = new Map<string, string>()

    const compilePlugin: Plugin = {
        name: 'svelterm:compile',

        async configResolved() {
            compilerModule = await import('svelte/compiler')
        },

        resolveId(id) {
            if (id === '@svelterm/core') {
                return fileURLToPath(new URL('../renderer/default.js', import.meta.url))
            }
            return null
        },

        transform(code, id) {
            if (!id.endsWith('.svelte')) return null

            const result = compilerModule.compile(code, {
                generate: 'client',
                css: 'external',
                filename: id,
                dev: true,
                experimental: {
                    customRenderer: '@svelterm/core',
                } as any,
            })

            // Collect extracted CSS
            if (result.css?.code) {
                cssMap.set(id, result.css.code)
            }

            return {
                code: result.js.code,
                map: result.js.map,
            }
        },
    }

    const devPlugin: Plugin = {
        name: 'svelterm:dev',
        apply: 'serve',

        configureServer(srv) {
            server = srv
            server.httpServer?.once('listening', () => startApp())
            if (!server.httpServer) setTimeout(startApp, 0)
        },

        handleHotUpdate({ file }) {
            if (file.endsWith('.svelte') || file.endsWith('.ts') || file.endsWith('.js')) {
                scheduleRestart()
            }
        },
    }

    function scheduleRestart() {
        if (restartTimer) clearTimeout(restartTimer)
        restartTimer = setTimeout(() => {
            restartTimer = null
            startApp()
        }, 100)
    }

    async function startApp() {
        if (cleanup) {
            try { cleanup() } catch {}
            cleanup = null
        }

        try {
            // Invalidate modules
            for (const mod of server.moduleGraph.idToModuleMap.values()) {
                if (mod.id?.endsWith('.svelte') || mod.id === entryPath) {
                    server.moduleGraph.invalidateModule(mod)
                }
            }

            const mod = await server.ssrLoadModule(entryPath)

            const Component = mod.default
            if (!Component) {
                console.error('[svelterm] Entry must default-export a Svelte component')
                return
            }

            const css = [...cssMap.values()].join('\n')

            const sveltermPath = fileURLToPath(new URL('../index.js', import.meta.url))
            const sveltermMod = await server.ssrLoadModule(sveltermPath)

            cleanup = sveltermMod.run(Component, {
                css,
                fullscreen: options.fullscreen ?? true,
                mouse: options.mouse ?? true,
                debug: options.debug,
                debugPort: options.debugPort,
            })
        } catch (err) {
            console.error('[svelterm] Error starting app:', err)
        }
    }

    return [compilePlugin, devPlugin]
}

