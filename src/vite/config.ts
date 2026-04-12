/**
 * Vite configuration helpers for svelterm.
 *
 * Usage in vite.config.ts:
 *
 *   import { svelte } from '@sveltejs/vite-plugin-svelte'
 *   import { svelterm } from '@svelterm/core/vite'
 *
 *   export default defineConfig({
 *       plugins: [
 *           svelte(svelterm.svelteOptions()),
 *           ...svelterm.terminalServer(),
 *       ],
 *       environments: svelterm.environments(),
 *   })
 *
 * Then in another terminal:
 *   npx svelterm dev http://localhost:5173/src/App.svelte
 */

import { createRunnableDevEnvironment } from 'vite'

export interface SveltermConfig {
    /** Custom renderer module specifier. Default: '@svelterm/core' */
    renderer?: string
    /** Terminal entry component. Default: './App.svelte' */
    entry?: string
}

/**
 * Returns svelte plugin options with dynamicCompileOptions for the
 * terminal environment.
 */
export function svelteOptions(config: SveltermConfig = {}) {
    const renderer = config.renderer ?? '@svelterm/core'
    return {
        dynamicCompileOptions({ environment }: any) {
            if (environment === 'terminal') {
                return {
                    generate: 'client',
                    css: 'external',
                    experimental: {
                        customRenderer: renderer,
                    },
                }
            }
        },
    }
}

/**
 * Returns Vite environment configuration for the terminal environment.
 */
export function environments() {
    return {
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
    }
}

/**
 * Returns Vite plugins that bridge the terminal environment over
 * WebSocket and serve CSS for the svelterm CLI.
 */
export function terminalServer(config: SveltermConfig = {}): any[] {
    const rendererModule = config.renderer ?? '@svelterm/core'
    let wss: any
    let WS: any

    return [{
        name: 'svelterm:server',
        apply: 'serve',
        async configResolved() {
            const ws = await import('ws')
            WS = ws.WebSocket
            wss = new ws.WebSocketServer({ noServer: true })
        },
        configureServer(server: any) {
            // Discovery endpoint
            server.middlewares.use('/__svelterm/config', (_req: any, res: any) => {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                    version: 1,
                    entry: config.entry ?? './App.svelte',
                    renderer: rendererModule,
                }))
            })

            // CSS endpoint — re-compiles .svelte files to extract CSS
            server.middlewares.use('/__svelterm/css', async (_req: any, res: any) => {
                const env = server.environments?.terminal
                if (!env) { res.end(''); return }

                const parts: string[] = []
                const { compile } = await import('svelte/compiler')
                const fs = await import('fs')

                for (const mod of env.moduleGraph?.idToModuleMap?.values() ?? []) {
                    if (mod.id?.endsWith('.svelte') && !mod.id.includes('?')) {
                        try {
                            const source = fs.readFileSync(mod.id, 'utf-8')
                            const result = compile(source, {
                                css: 'external',
                                filename: mod.id,
                                experimental: { customRenderer: rendererModule },
                            } as any)
                            if (result.css?.code) {
                                parts.push(result.css.code)
                            }
                        } catch {}
                    }
                }
                res.setHeader('Content-Type', 'text/css')
                res.end(parts.join('\n'))
            })

            // WebSocket bridge for ModuleRunner
            server.httpServer?.on('upgrade', (req: any, socket: any, head: any) => {
                if (req.url === '/__svelterm') {
                    wss.handleUpgrade(req, socket, head, (ws: any) => {
                        const env = server.environments?.terminal
                        if (!env) { ws.close(); return }

                        const client = {
                            send(payload: any) {
                                if (ws.readyState === WS.OPEN) {
                                    ws.send(JSON.stringify(payload))
                                }
                            },
                        }

                        ws.on('message', (data: any) => {
                            try {
                                const msg = JSON.parse(data.toString())
                                if (msg.type === 'ping') return
                                if (msg.type === 'custom' && msg.event) {
                                    env.hot.api?.innerEmitter?.emit(msg.event, msg.data, client)
                                }
                            } catch {}
                        })

                        const forward = (payload: any) => client.send(payload)
                        env.hot.api?.outsideEmitter?.on('send', forward)
                        client.send({ type: 'connected' })

                        ws.on('close', () => {
                            env.hot.api?.outsideEmitter?.off('send', forward)
                        })
                    })
                }
            })
        },
    }]
}

export const svelterm = { svelteOptions, environments, terminalServer }
