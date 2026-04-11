/**
 * Vite plugin for svelterm.
 *
 * Registers a 'terminal' environment and bridges it over WebSocket
 * so the svelterm CLI can connect as a remote ModuleRunner client.
 *
 * Usage:
 *   import { svelte } from '@sveltejs/vite-plugin-svelte'
 *   import { svelterm } from '@svelterm/core/vite'
 *
 *   export default defineConfig({
 *       plugins: [svelte({ ...svelterm.compileOptions() }), ...svelterm()]
 *   })
 *
 * Then in another terminal:
 *   npx svelterm dev http://localhost:5173/src/App.svelte
 */

import type { Plugin, ViteDevServer } from 'vite'
import { createRunnableDevEnvironment } from 'vite'
import { fileURLToPath } from 'url'
import { WebSocketServer, WebSocket } from 'ws'

export interface SveltermPluginOptions {
    /** Custom renderer module specifier. Default: '@svelterm/core' */
    renderer?: string
}

export function svelterm(options: SveltermPluginOptions = {}): Plugin[] {
    const rendererModule = options.renderer ?? '@svelterm/core'

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

    const apiPlugin: Plugin = {
        name: 'svelterm:api',
        apply: 'serve',

        configureServer(server: ViteDevServer) {
            // Discovery + CSS endpoints
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
                } else {
                    next()
                }
            })

            // WebSocket bridge: terminal environment <-> remote ModuleRunner
            const httpServer = server.httpServer
            if (httpServer) {
                const wss = new WebSocketServer({ noServer: true })

                httpServer.on('upgrade', (req, socket, head) => {
                    if (req.url === '/__svelterm/terminal') {
                        wss.handleUpgrade(req, socket, head, (ws) => {
                            bridgeEnvironmentToWebSocket(server, ws)
                        })
                    }
                })
            }
        },
    }

    return [configPlugin, resolvePlugin, apiPlugin]
}

/**
 * Bridge a WebSocket client to the terminal environment's hot channel.
 *
 * Protocol (matching Vite's ModuleRunner RPC):
 * Client sends: { type: "custom", event: "vite:invoke", data: { id, name, data } }
 * Server responds via client.send(): { type: "custom", event: "vite:invoke", data: { id, name, data } }
 *
 * The hot channel's listener for "vite:invoke" calls the handler with (payload, client).
 * We create a virtual client whose send() writes to the WebSocket.
 */
function bridgeEnvironmentToWebSocket(server: ViteDevServer, ws: WebSocket): void {
    const terminalEnv = (server as any).environments?.terminal
    if (!terminalEnv) {
        ws.close()
        return
    }

    const hot = terminalEnv.hot

    // Create a virtual "client" for the hot channel — its send() writes to the WebSocket
    const virtualClient = {
        send(payload: any) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload))
            }
        },
    }

    // Client -> Server: parse incoming messages and dispatch to hot channel
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString())

            if (msg.type === 'ping') return // keep-alive

            if (msg.type === 'custom' && msg.event) {
                // Emit the event on the hot channel with our virtual client
                // The hot channel's setInvokeHandler listener will pick up "vite:invoke"
                hot.api?.innerEmitter?.emit(msg.event, msg.data, virtualClient)
            }
        } catch {}
    })

    // Server -> Client: forward broadcast messages (HMR updates)
    const sendToClient = (payload: any) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(payload))
        }
    }

    if (hot.api?.outsideEmitter) {
        hot.api.outsideEmitter.on('send', sendToClient)
    }

    // Send initial connected message
    virtualClient.send({ type: 'connected' })

    ws.on('close', () => {
        if (hot.api?.outsideEmitter) {
            hot.api.outsideEmitter.off('send', sendToClient)
        }
    })
}

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
