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
import { fileURLToPath } from 'url'
import { WebSocketServer, WebSocket } from 'ws'

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
                            createEnvironment: 'createRunnableDevEnvironment' as any,
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

    // API + WebSocket endpoint for CLI communication
    const apiPlugin: Plugin = {
        name: 'svelterm:api',
        apply: 'serve',

        configureServer(server: ViteDevServer) {
            // Discovery endpoint
            server.middlewares.use('/__svelterm', (req, res, next) => {
                if (req.url === '/' || req.url === '') {
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({
                        version: 1,
                        renderer: rendererModule,
                    }))
                } else if (req.url === '/css') {
                    res.setHeader('Content-Type', 'text/css')
                    res.end(collectCss(server))
                } else {
                    next()
                }
            })

            // WebSocket server for terminal environment module runner
            const httpServer = server.httpServer
            if (httpServer) {
                const wss = new WebSocketServer({ noServer: true })

                httpServer.on('upgrade', (req, socket, head) => {
                    if (req.url === '/__svelterm/terminal') {
                        wss.handleUpgrade(req, socket, head, (ws) => {
                            handleTerminalClient(ws, server)
                        })
                    }
                })
            }
        },
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

/**
 * Handle a terminal CLI client connected via WebSocket.
 * Serves modules from the terminal environment and forwards HMR updates.
 */
function handleTerminalClient(ws: WebSocket, server: ViteDevServer): void {
    const terminalEnv = (server as any).environments?.terminal
    if (!terminalEnv) {
        ws.send(JSON.stringify({ type: 'error', message: 'terminal environment not configured' }))
        ws.close()
        return
    }

    // Handle module fetch requests from the CLI's ModuleRunner
    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString())
            if (msg.method === 'fetchModule') {
                const { id, importer } = msg.params
                try {
                    const result = await terminalEnv.fetchModule(id, importer)
                    ws.send(JSON.stringify({ id: msg.id, result }))
                } catch (err: any) {
                    ws.send(JSON.stringify({ id: msg.id, error: err.message }))
                }
            }
        } catch {}
    })

    // Forward HMR updates from the terminal environment to the CLI
    if (terminalEnv.hot) {
        terminalEnv.hot.on('vite:ws:send', (payload: any) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload))
            }
        })
    }

    ws.on('close', () => {
        // Clean up if needed
    })
}
