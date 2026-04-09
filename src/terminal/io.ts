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
 */
export class ProcessIO implements TerminalIO {
    private dataCallbacks: Array<(data: Buffer) => void> = []
    private resizeCallbacks: Array<() => void> = []
    private onStdinData = (data: Buffer) => {
        for (const cb of this.dataCallbacks) cb(data)
    }
    private onStdoutResize = () => {
        for (const cb of this.resizeCallbacks) cb()
    }
    private listening = false

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
            process.stdin.on('data', this.onStdinData)
            this.listening = true
        }
    }

    onResize(callback: () => void): void {
        this.resizeCallbacks.push(callback)
        process.stdout.on('resize', this.onStdoutResize)
    }

    enableRawMode(): void {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true)
            process.stdin.resume()
        }
    }

    disableRawMode(): void {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false)
            process.stdin.pause()
        }
    }

    dispose(): void {
        process.stdin.removeListener('data', this.onStdinData)
        process.stdout.removeListener('resize', this.onStdoutResize)
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
        const buf = Buffer.from(data)
        for (const cb of this.dataCallbacks) cb(buf)
    }

    /** Notify svelterm of a resize */
    setSize(width: number, height: number): void {
        this._width = width
        this._height = height
        for (const cb of this.resizeCallbacks) cb()
    }
}
