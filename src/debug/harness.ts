/**
 * Scenario test harness — drives a running svelterm app through its
 * debug socket. The out-of-process counterpart of sumi's sumitest
 * Harness: every input op settles the render loop before resolving, so
 * a following snapshot reflects the injected event.
 *
 * ```ts
 * const h = await connect({ port: 9444 })
 * await h.key('Tab')
 * await h.text('hello')
 * assert.match(await h.screenText(), /hello/)
 * h.close()
 * ```
 */

import { connectDebugClient, type DebugClient } from '../devtools/client.js'
import type { Cell } from '../render/buffer.js'

export interface KeyMods {
    ctrl?: boolean
    shift?: boolean
    meta?: boolean
}

export interface Harness {
    /** One key chord by name: `key('w', { ctrl: true })`, `key('Tab')`. */
    key(key: string, mods?: KeyMods): Promise<void>
    /** Type a string character by character. */
    text(text: string): Promise<void>
    /** Left press + release at a 0-based cell. */
    click(x: number, y: number): Promise<void>
    /** Two rapid clicks — selects the word in an editable field. */
    doubleClick(x: number, y: number): Promise<void>
    paste(text: string): Promise<void>
    /** Wait until the app's render loop has no pending work. */
    settle(timeoutMs?: number): Promise<void>
    screenText(): Promise<string>
    styledText(): Promise<string>
    cellAt(x: number, y: number): Promise<Cell>
    /** Settle and poll the screen until it matches, or time out. */
    waitForText(pattern: string | RegExp, timeoutMs?: number): Promise<string>
    /** Escape hatch to any debug-protocol method. */
    request(method: string, params?: Record<string, unknown>): Promise<any>
    close(): void
}

export interface ConnectOptions {
    port?: number
    /** Keep retrying the connection this long (the app may still be starting). */
    timeoutMs?: number
}

const DEFAULT_PORT = 9444
const CONNECT_RETRY_DELAY_MS = 50
const WAIT_POLL_DELAY_MS = 25

export async function connect(options: ConnectOptions = {}): Promise<Harness> {
    const port = options.port ?? DEFAULT_PORT
    const client = await connectWithRetry(port, options.timeoutMs ?? 0)
    return new SocketHarness(client)
}

async function connectWithRetry(port: number, timeoutMs: number): Promise<DebugClient> {
    const deadline = Date.now() + timeoutMs
    while (true) {
        try {
            return await connectDebugClient(port)
        } catch (err) {
            if (Date.now() + CONNECT_RETRY_DELAY_MS > deadline) throw err
            await delay(CONNECT_RETRY_DELAY_MS)
        }
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

class SocketHarness implements Harness {
    constructor(private client: DebugClient) {}

    request(method: string, params: Record<string, unknown> = {}): Promise<any> {
        return this.client.request(method, params)
    }

    private async input(method: string, params: Record<string, unknown>): Promise<void> {
        await this.request(`Input.${method}`, params)
        await this.settle()
    }

    key(key: string, mods: KeyMods = {}): Promise<void> {
        return this.input('key', { key, ...mods })
    }

    text(text: string): Promise<void> {
        return this.input('text', { text })
    }

    async click(x: number, y: number): Promise<void> {
        await this.request('Input.mouse', { type: 'press', x, y })
        await this.input('mouse', { type: 'release', x, y })
    }

    async doubleClick(x: number, y: number): Promise<void> {
        await this.click(x, y)
        await this.click(x, y)
    }

    paste(text: string): Promise<void> {
        return this.input('paste', { text })
    }

    async settle(timeoutMs?: number): Promise<void> {
        await this.request('Screen.settle', timeoutMs === undefined ? {} : { timeoutMs })
    }

    async screenText(): Promise<string> {
        const { text } = await this.request('Screen.text')
        return text
    }

    async styledText(): Promise<string> {
        const { text } = await this.request('Screen.styled')
        return text
    }

    cellAt(x: number, y: number): Promise<Cell> {
        return this.request('Screen.cell', { x, y })
    }

    async waitForText(pattern: string | RegExp, timeoutMs = 2000): Promise<string> {
        const matcher = typeof pattern === 'string'
            ? (text: string) => text.includes(pattern)
            : (text: string) => pattern.test(text)
        const deadline = Date.now() + timeoutMs
        let last = ''
        while (Date.now() < deadline) {
            await this.settle()
            last = await this.screenText()
            if (matcher(last)) return last
            await delay(WAIT_POLL_DELAY_MS)
        }
        throw new Error(`waitForText(${pattern}) timed out after ${timeoutMs}ms; last screen:\n${last}`)
    }

    close(): void {
        this.client.close()
    }
}
