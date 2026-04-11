/**
 * Vite configuration helpers for svelterm.
 *
 * Usage in vite.config.ts:
 *
 *   import { svelte } from '@sveltejs/vite-plugin-svelte'
 *   import { svelterm } from '@svelterm/core/vite'
 *
 *   export default defineConfig({
 *       plugins: [svelte(svelterm.svelteOptions())],
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
 * Returns a Vite plugin that bridges the terminal environment
 * over WebSocket for the svelterm CLI.
 */
const _cssStore = new Map<string, string>()

/**
 * Returns a tiny plugin that captures CSS from svelte compilation
 * in the terminal environment before Vite's SSR transform discards it.
 */
export function cssCollector(): any {
    return {
        name: 'svelterm:css',
        load(id: string) {
            // Log what we see
            if (id.includes('.svelte')) {
                console.error('[css-collector] load:', id.substring(id.lastIndexOf('/') + 1))
            }
            return null
        },
        transform(code: string, id: string) {
            if (id.includes('.svelte')) {
                console.error('[css-collector] transform:', id.substring(id.lastIndexOf('/') + 1), 'len:', code.length)
            }
            if (id.includes('type=style') && code.length > 0) {
                _cssStore.set(id, code)
            }
            return null
        },
    }
}

export function terminalServer(config: SveltermConfig = {}): any {
    const rendererModule = config.renderer ?? '@svelterm/core'
    let wss: any
    let WS: any
    return [{
        name: 'svelterm:css-capture',
        // Capture CSS from svelte's CSS virtual modules in the terminal env
        // Must run before Vite's SSR transform empties CSS modules
        applyToEnvironment(env: any) { return env.name === 'terminal' },
        transform(code: string, id: string) {
            if (id.includes('type=style') && id.includes('.svelte') && code.length > 0) {
                _cssStore.set(id, code)
            }
            return null
        },
    }, {
        name: 'svelterm:server',
        apply: 'serve',
        async configResolved() {
            const ws = await import('ws')
            WS = ws.WebSocket
            wss = new ws.WebSocketServer({ noServer: true })
        },
        configureServer(server: any) {
            // CSS endpoint — compiles .svelte files to extract CSS
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
            server.middlewares.use('/__svelterm/debug', (_req: any, res: any) => {
                const env = server.environments?.terminal
                const info: any[] = []
                for (const mod of env?.moduleGraph?.idToModuleMap?.values() ?? []) {
                    if (mod.id?.includes('style') || mod.id?.includes('.css')) {
                        const tr = mod.transformResult
                        info.push({
                            id: mod.id,
                            hasTransform: !!tr,
                            codeLen: tr?.code?.length,
                            codeSample: tr?.code?.substring(0, 300),
                        })
                    }
                }
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(info, null, 2))
            })

            // Serve collected CSS
            server.middlewares.use('/__svelterm/css', (_req: any, res: any) => {
                res.setHeader('Content-Type', 'text/css')
                res.end([..._cssStore.values()].join('\n'))
            })

            server.httpServer?.on('upgrade', (req: any, socket: any, head: any) => {
                if (req.url === '/__svelterm') {
                    wss.handleUpgrade(req, socket, head, (ws: any) => {
                        const env = server.environments?.terminal
                        if (!env) { ws.close(); return }

                        // Virtual client for the hot channel
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

                        // Forward HMR updates
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
