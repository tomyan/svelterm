import * as ansi from '../render/ansi.js'

export interface TerminalSize {
    width: number
    height: number
}

export function getTerminalSize(): TerminalSize {
    return {
        width: process.stdout.columns ?? 80,
        height: process.stdout.rows ?? 24,
    }
}

export function enterFullscreen(): void {
    process.stdout.write(ansi.enterAltScreen())
    process.stdout.write(ansi.hideCursor())
    process.stdout.write(ansi.clearScreen())
}

export function exitFullscreen(): void {
    process.stdout.write(ansi.showCursor())
    process.stdout.write(ansi.exitAltScreen())
}

export function enableRawMode(): void {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true)
        process.stdin.resume()
    }
}

export function disableRawMode(): void {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
        process.stdin.pause()
    }
}

export function writeOutput(data: string): void {
    process.stdout.write(data)
}
