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
