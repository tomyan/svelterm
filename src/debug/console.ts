/**
 * Console domain — intercepts console.log/warn/error/info and forwards
 * to debug clients as events. Also captures uncaught errors.
 */

import { DebugServer, type DebugDomain } from './server.js'

interface ConsoleEntry {
    level: 'log' | 'warn' | 'error' | 'info' | 'debug'
    args: string[]
    timestamp: number
}

export class ConsoleDomain implements DebugDomain {
    private server: DebugServer
    private buffer: ConsoleEntry[] = []
    private maxBuffer = 1000
    private originals: {
        log: typeof console.log
        warn: typeof console.warn
        error: typeof console.error
        info: typeof console.info
        debug: typeof console.debug
    }

    constructor(server: DebugServer) {
        this.server = server

        // Save originals before patching
        this.originals = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            info: console.info.bind(console),
            debug: console.debug.bind(console),
        }
    }

    start(): void {
        const levels = ['log', 'warn', 'error', 'info', 'debug'] as const
        for (const level of levels) {
            const original = this.originals[level]
            ;(console as any)[level] = (...args: any[]) => {
                // Still write to stderr so output isn't lost
                original(...args)
                this.capture(level, args)
            }
        }

        // Capture uncaught errors
        process.on('uncaughtException', (err) => {
            this.capture('error', [`Uncaught: ${err.stack ?? err.message}`])
        })
    }

    stop(): void {
        // Restore originals
        console.log = this.originals.log
        console.warn = this.originals.warn
        console.error = this.originals.error
        console.info = this.originals.info
        console.debug = this.originals.debug
    }

    handle(method: string, params: Record<string, any>): any {
        switch (method) {
            case 'getEntries':
                return { entries: this.buffer.slice(-(params.count ?? 100)) }
            case 'clear':
                this.buffer = []
                return {}
            default:
                throw new Error(`Console.${method} not implemented`)
        }
    }

    private capture(level: ConsoleEntry['level'], args: any[]): void {
        const entry: ConsoleEntry = {
            level,
            args: args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2) ?? String(a)),
            timestamp: Date.now(),
        }

        this.buffer.push(entry)
        if (this.buffer.length > this.maxBuffer) {
            this.buffer.shift()
        }

        this.server.emit('Console.messageAdded', { entry })
    }
}
