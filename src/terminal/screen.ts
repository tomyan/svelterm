import * as ansi from '../render/ansi.js'
import type { TerminalIO } from './io.js'

export function enterFullscreen(io: TerminalIO): void {
    io.write(ansi.enterAltScreen())
    io.write(ansi.clearScreen())
}

export function exitFullscreen(io: TerminalIO): void {
    io.write(ansi.exitAltScreen())
}
