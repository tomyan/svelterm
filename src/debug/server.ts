/**
 * Svelterm Debug Protocol server.
 * WebSocket server on localhost using the ws package.
 * Only active when explicitly opted in via mount({ debug: true }).
 */

import { WebSocketServer, WebSocket } from 'ws'

export interface DebugDomain {
    handle(method: string, params: Record<string, any>): any
}

export class DebugServer {
    private wss: WebSocketServer | null = null
    private clients: Set<WebSocket> = new Set()
    private domains: Map<string, DebugDomain> = new Map()
    private port: number

    constructor(port: number = 9444) {
        this.port = port
    }

    registerDomain(name: string, domain: DebugDomain): void {
        this.domains.set(name, domain)
    }

    start(): Promise<void> {
        return new Promise((resolve) => {
            this.wss = new WebSocketServer({ host: '127.0.0.1', port: this.port }, () => {
                const addr = this.wss?.address()
                if (addr && typeof addr !== 'string') this.port = addr.port
                resolve()
            })

            this.wss.on('connection', (ws) => {
                this.clients.add(ws)
                ws.on('message', (data) => {
                    try {
                        const msg = JSON.parse(data.toString())
                        this.handleMessage(ws, msg)
                    } catch {
                        // Malformed — ignore
                    }
                })
                ws.on('close', () => { this.clients.delete(ws) })
                ws.on('error', () => { this.clients.delete(ws) })
            })

            this.wss.on('error', (err) => {
                console.error(`[debug] server error: ${err.message}`)
                resolve() // don't block — debug is best-effort
            })
        })
    }

    get actualPort(): number {
        return this.port
    }

    stop(): void {
        for (const client of this.clients) client.close()
        this.clients.clear()
        this.wss?.close()
        this.wss = null
    }

    emit(method: string, params: Record<string, any>): void {
        if (this.clients.size === 0) return
        const msg = JSON.stringify({ method, params })
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg)
            }
        }
    }

    get connected(): number {
        return this.clients.size
    }

    private handleMessage(ws: WebSocket, msg: { id: number; method: string; params?: any }): void {
        const dotIdx = msg.method.indexOf('.')
        if (dotIdx === -1) {
            ws.send(JSON.stringify({ id: msg.id, error: { message: `Invalid method: ${msg.method}` } }))
            return
        }

        const domainName = msg.method.substring(0, dotIdx)
        const methodName = msg.method.substring(dotIdx + 1)
        const domain = this.domains.get(domainName)

        if (!domain) {
            ws.send(JSON.stringify({ id: msg.id, error: { message: `Unknown domain: ${domainName}` } }))
            return
        }

        try {
            const result = domain.handle(methodName, msg.params ?? {})
            ws.send(JSON.stringify({ id: msg.id, result: result ?? {} }))
        } catch (err: any) {
            ws.send(JSON.stringify({ id: msg.id, error: { message: err.message ?? 'Unknown error' } }))
        }
    }
}
