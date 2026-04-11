/**
 * Vite plugin for svelterm.
 *
 * Registers a 'terminal' environment and uses dynamicCompileOptions
 * to configure per-environment Svelte compilation. Works alongside
 * sveltekit() or svelte().
 *
 * Usage:
 *   import { sveltekit } from '@sveltejs/kit/vite'
 *   import { svelterm } from '@svelterm/core/vite'
 *
 *   export default defineConfig({
 *       plugins: [sveltekit(), svelterm()]
 *   })
 *
 * Or standalone:
 *   import { svelte } from '@sveltejs/vite-plugin-svelte'
 *   import { svelterm } from '@svelterm/core/vite'
 *
 *   export default defineConfig({
 *       plugins: [svelte(), svelterm()]
 *   })
 *
 * Then connect from another terminal:
 *   npx svelterm dev http://localhost:5173
 */

import type { Plugin, ViteDevServer } from 'vite'
import { createRunnableDevEnvironment, createServerModuleRunner } from 'vite'
import { fileURLToPath } from 'url'

export interface SveltermPluginOptions {
    /** Custom renderer module specifier. Default: '@svelterm/core' */
    renderer?: string
}

export function svelterm(options: SveltermPluginOptions = {}): Plugin[] {
    const rendererModule = options.renderer ?? '@svelterm/core'

    // Register the terminal environment
    const configPlugin: Plugin = {
        name: 'svelterm:config',

        config() {
            return {
                environments: {
                    terminal: {
                        dev: {
                            createEnvironment(name: string, config: any) {
                                return createRunnableDevEnvironment(name, config)
                            },
                        },
                        resolve: {
                            conditions: ['svelte', 'node'],
                            noExternal: ['svelte'],
                        },
                    },
                },
            }
        },
    }

    // Resolve the renderer module in the terminal environment
    const resolvePlugin: Plugin = {
        name: 'svelterm:resolve',

        applyToEnvironment(env) {
            return env.name === 'terminal'
        },

        resolveId(id) {
            if (id === rendererModule) {
                return fileURLToPath(new URL('../renderer/default.js', import.meta.url))
            }
            return null
        },
    }

    let appCleanup: (() => void) | null = null
    let restartTimer: ReturnType<typeof setTimeout> | null = null

    const apiPlugin: Plugin = {
        name: 'svelterm:api',
        apply: 'serve',

        configureServer(server: ViteDevServer) {
            server.middlewares.use('/__svelterm', (req, res, next) => {
                const reqUrl = req.url ?? ''
                if (reqUrl === '/' || reqUrl === '') {
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({
                        version: 1,
                        renderer: rendererModule,
                    }))
                } else if (reqUrl === '/css') {
                    res.setHeader('Content-Type', 'text/css')
                    res.end(collectCss(server))
                } else if (reqUrl.startsWith('/start?')) {
                    const params = new URLSearchParams(reqUrl.slice(7))
                    const entry = params.get('entry')
                    if (!entry) {
                        res.statusCode = 400
                        res.end('entry parameter required')
                        return
                    }
                    startTerminalApp(server, entry)
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ ok: true }))
                } else if (reqUrl === '/stop') {
                    stopTerminalApp()
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ ok: true }))
                } else {
                    next()
                }
            })
        },

        handleHotUpdate({ file }) {
            if (file.endsWith('.svelte') || file.endsWith('.ts') || file.endsWith('.js')) {
                if (appCleanup && currentEntry) {
                    scheduleRestart()
                }
            }
        },
    }

    let currentEntry: string | null = null
    let currentServer: ViteDevServer | null = null

    function scheduleRestart() {
        if (restartTimer) clearTimeout(restartTimer)
        restartTimer = setTimeout(() => {
            restartTimer = null
            if (currentServer && currentEntry) {
                startTerminalApp(currentServer, currentEntry)
            }
        }, 100)
    }

    async function startTerminalApp(server: ViteDevServer, entry: string) {
        stopTerminalApp()
        currentServer = server
        currentEntry = entry

        try {
            const terminalEnv = (server as any).environments?.terminal
            if (!terminalEnv) {
                console.error('[svelterm] terminal environment not found')
                return
            }

            const runner = createServerModuleRunner(terminalEnv)

            // Load the entry component
            const mod = await runner.import(entry)
            const Component = mod.default
            if (!Component) {
                console.error(`[svelterm] ${entry} must default-export a Svelte component`)
                return
            }

            // Load svelterm
            const sveltermMod = await runner.import('@svelterm/core/app')

            // Get CSS
            const css = collectCss(server)

            appCleanup = sveltermMod.run(Component, {
                css,
                fullscreen: true,
                mouse: true,
            })
        } catch (err) {
            console.error('[svelterm] Error starting app:', err)
        }
    }

    function stopTerminalApp() {
        if (appCleanup) {
            try { appCleanup() } catch {}
            appCleanup = null
        }
    }

    return [configPlugin, resolvePlugin, apiPlugin]
}

/**
 * Collect CSS from .svelte modules compiled for the terminal environment.
 * Looks for __svelterm_css__ exports attached by the compiler transform.
 */
function collectCss(server: any): string {
    const parts: string[] = []
    const terminalEnv = server.environments?.terminal
    if (!terminalEnv) return ''

    for (const mod of terminalEnv.moduleGraph?.idToModuleMap?.values() ?? []) {
        if (mod.id?.endsWith('.svelte') && mod.ssrTransformResult) {
            const code = mod.ssrTransformResult.code
            const match = code.match(/code:\s*'([\s\S]*?)'/)
            if (match) {
                parts.push(match[1].replace(/\\n/g, '\n'))
            }
        }
    }
    return parts.join('\n')
}

/**
 * Returns dynamicCompileOptions config for use with svelte() or sveltekit().
 * This function should be spread into the svelte plugin options.
 *
 * Usage:
 *   svelte({
 *       ...svelterm.compileOptions(),
 *   })
 */
svelterm.compileOptions = function(rendererModule = '@svelterm/core') {
    return {
        dynamicCompileOptions({ environment }: any) {
            if (environment === 'terminal') {
                return {
                    generate: 'client',
                    css: 'external',
                    experimental: {
                        customRenderer: rendererModule,
                    },
                }
            }
        },
    }
}

