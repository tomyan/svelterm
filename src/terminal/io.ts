/**
 * Terminal IO interface — abstracts over the physical terminal.
 *
 * Two implementations:
 * - ProcessIO: passthrough to process.stdout/stdin (Node.js terminal)
 * - In-process IO: connects to a VT100 emulator in the same JS context (browser)
 */

export interface TerminalIO {
    /** Write a string to the terminal output */
    write(data: string): void

    /** Get current terminal dimensions */
    getSize(): { width: number; height: number }

    /** Subscribe to incoming data (keyboard, mouse, query responses) */
    onData(callback: (data: Buffer) => void): void

    /** Subscribe to terminal resize */
    onResize(callback: () => void): void

    /** Enable raw input mode (no echo, no line buffering) */
    enableRawMode(): void

    /** Disable raw input mode */
    disableRawMode(): void

    /** Clean up all listeners */
    dispose(): void
}

/**
 * Passthrough to process.stdout/stdin — the default for Node.js terminal apps.
 *
 * When stdin is not a TTY — `curl app.mjs | node -` delivers the script
 * itself on stdin — input falls back to the controlling terminal
 * (`/dev/tty`) so the app stays interactive.
 */
export class ProcessIO implements TerminalIO {
    private dataCallbacks: Array<(data: Buffer) => void> = []
    private resizeCallbacks: Array<() => void> = []
    private input: NodeJS.ReadStream = process.stdin
    private onInputData = (data: Buffer) => {
        for (const cb of this.dataCallbacks) cb(data)
    }
    private onStdoutResize = () => {
        for (const cb of this.resizeCallbacks) cb()
    }
    private listening = false
    private rawModeWanted = false
    private disposed = false

    constructor() {
        // With `node -` the script is read to EOF before execution, so no
        // input can be lost while the async reopen is in flight.
        if (!process.stdin.isTTY) {
            void this.reopenControllingTerminal()
        }
    }

    private async reopenControllingTerminal(): Promise<void> {
        try {
            const [fs, tty] = await Promise.all([import('node:fs'), import('node:tty')])
            const stream = new tty.ReadStream(fs.openSync('/dev/tty', 'r'))
            if (this.disposed) {
                stream.destroy()
                return
            }
            const previous = this.input
            this.input = stream
            if (this.listening) {
                previous.removeListener('data', this.onInputData)
                stream.on('data', this.onInputData)
            }
            if (this.rawModeWanted && stream.isTTY) {
                stream.setRawMode(true)
                stream.resume()
            }
        } catch {
            // No controlling terminal (CI, Windows pipe) — stay on stdin.
        }
    }

    write(data: string): void {
        process.stdout.write(data)
    }

    getSize(): { width: number; height: number } {
        return {
            width: Math.max(1, process.stdout.columns ?? 80),
            height: Math.max(1, process.stdout.rows ?? 24),
        }
    }

    onData(callback: (data: Buffer) => void): void {
        this.dataCallbacks.push(callback)
        if (!this.listening) {
            this.input.on('data', this.onInputData)
            this.listening = true
        }
    }

    onResize(callback: () => void): void {
        this.resizeCallbacks.push(callback)
        process.stdout.on('resize', this.onStdoutResize)
    }

    enableRawMode(): void {
        this.rawModeWanted = true
        if (this.input.isTTY) {
            this.input.setRawMode(true)
            this.input.resume()
        }
    }

    disableRawMode(): void {
        this.rawModeWanted = false
        if (this.input.isTTY) {
            this.input.setRawMode(false)
            this.input.pause()
        }
    }

    dispose(): void {
        this.disposed = true
        this.input.removeListener('data', this.onInputData)
        process.stdout.removeListener('resize', this.onStdoutResize)
        if (this.input !== process.stdin) {
            this.input.destroy()
        }
        this.dataCallbacks = []
        this.resizeCallbacks = []
        this.listening = false
    }
}

/**
 * In-process IO — connects svelterm to a consumer in the same JS context.
 * Used for browser-based terminal rendering (svelterm → VT100 emulator).
 */
export class InProcessIO implements TerminalIO {
    private dataCallbacks: Array<(data: Buffer) => void> = []
    private resizeCallbacks: Array<() => void> = []
    private _width: number
    private _height: number

    /** Called when svelterm writes output — connect this to a VT100 emulator */
    onOutput?: (data: string) => void

    constructor(width: number, height: number) {
        this._width = width
        this._height = height
    }

    write(data: string): void {
        this.onOutput?.(data)
    }

    getSize(): { width: number; height: number } {
        return { width: this._width, height: this._height }
    }

    onData(callback: (data: Buffer) => void): void {
        this.dataCallbacks.push(callback)
    }

    onResize(callback: () => void): void {
        this.resizeCallbacks.push(callback)
    }

    enableRawMode(): void {}
    disableRawMode(): void {}

    dispose(): void {
        this.dataCallbacks = []
        this.resizeCallbacks = []
        this.onOutput = undefined
    }

    /** Feed input data (keyboard/mouse) into svelterm */
    feedInput(data: string): void {
        const buf = typeof Buffer !== 'undefined'
            ? Buffer.from(data)
            : new TextEncoder().encode(data)
        for (const cb of this.dataCallbacks) cb(buf as any)
    }

    /** Notify svelterm of a resize */
    setSize(width: number, height: number): void {
        this._width = width
        this._height = height
        for (const cb of this.resizeCallbacks) cb()
    }
}
