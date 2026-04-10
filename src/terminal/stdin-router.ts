/**
 * Single point of control for terminal input.
 *
 * All input data flows through here. Incoming bytes are classified and
 * routed to the appropriate handler. Query-response interactions (OSC 11,
 * DA1, etc.) are serialised — only one query is in-flight at a time.
 */

import type { TerminalIO } from './io.js'

export interface StdinHandlers {
    onKey: (data: Buffer | Uint8Array) => void
    onMouse: (data: Buffer | Uint8Array) => void
    onPaste: (text: string) => void
}

interface PendingQuery {
    /** Pattern to match in incoming data */
    match: (data: string) => string | null
    /** Called with the matched response */
    resolve: (response: string) => void
    /** Timeout handle */
    timer: ReturnType<typeof setTimeout>
}

const OSC_RESPONSE_RE = /\x1b\](\d+);([^\x07\x1b]*?)(?:\x07|\x1b\\)/
const SGR_MOUSE_RE = /\x1b\[<\d+;\d+;\d+[Mm]/g
const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'

export class StdinRouter {
    private io: TerminalIO
    private handlers: StdinHandlers | null = null
    private pendingQuery: PendingQuery | null = null
    private queryQueue: Array<{
        write: string
        match: (data: string) => string | null
        resolve: (response: string) => void
        reject: (err: Error) => void
        timeoutMs: number
    }> = []
    private pasteBuffer: string | null = null

    constructor(io: TerminalIO) {
        this.io = io
    }

    start(handlers: StdinHandlers): void {
        this.handlers = handlers
        this.io.onData(this.onData)
    }

    stop(): void {
        this.handlers = null
        if (this.pendingQuery) {
            clearTimeout(this.pendingQuery.timer)
            this.pendingQuery = null
        }
        this.queryQueue = []
    }

    /**
     * Send a query and wait for a matching response.
     * Queries are serialised — queued if one is already in-flight.
     */
    query(
        write: string,
        match: (data: string) => string | null,
        timeoutMs: number = 200,
    ): Promise<string | null> {
        return new Promise((resolve, reject) => {
            this.queryQueue.push({ write, match, resolve: resolve as any, reject, timeoutMs })
            this.drainQueryQueue()
        })
    }

    private drainQueryQueue(): void {
        if (this.pendingQuery || this.queryQueue.length === 0) return

        const { write, match, resolve, timeoutMs } = this.queryQueue.shift()!

        const timer = setTimeout(() => {
            this.pendingQuery = null
            resolve(null as any)
            this.drainQueryQueue()
        }, timeoutMs)

        this.pendingQuery = {
            match,
            resolve: (response: string) => {
                clearTimeout(timer)
                this.pendingQuery = null
                resolve(response)
                this.drainQueryQueue()
            },
            timer,
        }

        this.io.write(write)
    }

    private onData = (data: Buffer | Uint8Array): void => {
        const str = typeof Buffer !== 'undefined' && Buffer.isBuffer(data)
            ? data.toString()
            : new TextDecoder().decode(data)

        // Check for pending query response first
        if (this.pendingQuery) {
            const result = this.pendingQuery.match(str)
            if (result !== null) {
                this.pendingQuery.resolve(result)
                return
            }
        }

        // Bracketed paste accumulation
        if (this.pasteBuffer !== null) {
            const endIdx = str.indexOf(PASTE_END)
            if (endIdx !== -1) {
                this.pasteBuffer += str.substring(0, endIdx)
                this.handlers?.onPaste(this.pasteBuffer)
                this.pasteBuffer = null
            } else {
                this.pasteBuffer += str
            }
            return
        }

        if (str.startsWith(PASTE_START)) {
            const endIdx = str.indexOf(PASTE_END)
            if (endIdx !== -1) {
                this.handlers?.onPaste(str.substring(PASTE_START.length, endIdx))
            } else {
                this.pasteBuffer = str.substring(PASTE_START.length)
            }
            return
        }

        // OSC response (not matched by a pending query — discard)
        if (OSC_RESPONSE_RE.test(str)) return

        // Mouse events — may be batched in a single chunk
        SGR_MOUSE_RE.lastIndex = 0
        const mouseMatches = [...str.matchAll(SGR_MOUSE_RE)]
        if (mouseMatches.length > 0) {
            for (const match of mouseMatches) {
                this.handlers?.onMouse(toBytes(match[0]))
            }
            // Check if there's non-mouse data remaining
            let remaining = str
            for (const match of mouseMatches) {
                remaining = remaining.replace(match[0], '')
            }
            if (remaining.length > 0 && remaining.trim().length > 0) {
                this.handlers?.onKey(toBytes(remaining))
            }
            return
        }

        // Everything else is keyboard input
        this.handlers?.onKey(data)
    }
}

/** Match an OSC 11 response and extract the RGB values */
export function matchOSC11(data: string): string | null {
    const match = data.match(/\x1b\]11;rgb:([0-9a-f]+)\/([0-9a-f]+)\/([0-9a-f]+)/i)
    if (!match) return null
    return `${match[1]}/${match[2]}/${match[3]}`
}

/** Parse an OSC 11 RGB response into a color scheme */
export function parseOSC11Scheme(rgb: string): 'dark' | 'light' {
    const parts = rgb.split('/')
    const r = parseInt(parts[0].substring(0, 2), 16)
    const g = parseInt(parts[1].substring(0, 2), 16)
    const b = parseInt(parts[2].substring(0, 2), 16)
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return luminance > 128 ? 'light' : 'dark'
}

function toBytes(str: string): Buffer | Uint8Array {
    if (typeof Buffer !== 'undefined') return Buffer.from(str)
    return new TextEncoder().encode(str)
}
