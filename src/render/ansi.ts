import { quantizeTo256, quantizeTo16 } from './color-depth.js'
import type { ColorDepth } from '../terminal/capabilities.js'

const ESC = '\x1b'
const CSI = `${ESC}[`

// Colour depth applies to the whole process's output stream, set once
// after capability detection (default: truecolor, today's common case).
let colorDepth: ColorDepth = 'truecolor'

export function setColorDepth(depth: ColorDepth): void {
    colorDepth = depth
}

export function getColorDepth(): ColorDepth {
    return colorDepth
}

function expandHex(color: string): string {
    if (color.length === 4) {
        return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
    }
    return color
}

export function moveTo(col: number, row: number): string {
    return `${CSI}${row};${col}H`
}

export function clearScreen(): string {
    return `${CSI}2J`
}

export function hideCursor(): string {
    return `${CSI}?25l`
}

export function showCursor(): string {
    return `${CSI}?25h`
}

export function enterAltScreen(): string {
    return `${CSI}?1049h`
}

export function exitAltScreen(): string {
    return `${CSI}?1049l`
}

export function resetStyle(): string {
    return `${CSI}0m`
}

export function bold(): string {
    return `${CSI}1m`
}

export function dim(): string {
    return `${CSI}2m`
}

export function italic(): string {
    return `${CSI}3m`
}

export function underline(): string {
    return `${CSI}4m`
}

export function strikethrough(): string {
    return `${CSI}9m`
}

export function inverse(): string {
    return `${CSI}7m`
}

export function fgColor(color: string): string {
    return sgrColor(color, ANSI_FG, 38)
}

export function bgColor(color: string): string {
    return sgrColor(color, ANSI_BG, 48)
}

function sgrColor(color: string, names: Record<string, number>, extended: 38 | 48): string {
    if (colorDepth === 'mono') {
        // Colour is disabled; only default (the reset) still emits.
        return color === 'default' ? `${CSI}${names.default}m` : ''
    }
    const code = names[color]
    if (code !== undefined) return `${CSI}${code}m`
    if (!color.startsWith('#')) return ''

    const hex = expandHex(color)
    switch (colorDepth) {
        case '256':
            return `${CSI}${extended};5;${quantizeTo256(hex)}m`
        case '16':
            return `${CSI}${names[quantizeTo16(hex)]}m`
        default: {
            const r = parseInt(hex.slice(1, 3), 16)
            const g = parseInt(hex.slice(3, 5), 16)
            const b = parseInt(hex.slice(5, 7), 16)
            return `${CSI}${extended};2;${r};${g};${b}m`
        }
    }
}

const ANSI_FG: Record<string, number> = {
    black: 30, red: 31, green: 32, yellow: 33,
    blue: 34, magenta: 35, cyan: 36, white: 37,
    default: 39,
}

export function hyperlinkOpen(url: string): string {
    return `\x1b]8;;${url}\x1b\\`
}

export function hyperlinkClose(): string {
    return `\x1b]8;;\x1b\\`
}

export function enableMouse(): string {
    return `${CSI}?1006h${CSI}?1003h` // enable SGR mode, then any-event tracking
}

export function disableMouse(): string {
    return `${CSI}?1003l${CSI}?1006l`
}

export function setCursorShape(shape: 'block' | 'underline' | 'bar'): string {
    const code = shape === 'block' ? 2 : shape === 'underline' ? 4 : 6
    return `${CSI}${code} q`
}

/** DECSCUSR 0 — the terminal's configured default cursor. */
export function resetCursorShape(): string {
    return `${CSI}0 q`
}

/** Kitty keyboard protocol: push disambiguate-escape-codes mode. */
export function pushKittyKeyboard(): string {
    return `${CSI}>1u`
}

/** Kitty keyboard protocol: pop our mode entry. */
export function popKittyKeyboard(): string {
    return `${CSI}<u`
}

export function enableBracketedPaste(): string {
    return `${CSI}?2004h`
}

export function disableBracketedPaste(): string {
    return `${CSI}?2004l`
}

/** DECSTBM — set the scroll region to rows [top, bottom] (1-based). */
export function setScrollRegion(top: number, bottom: number): string {
    return `${CSI}${top};${bottom}r`
}

/** DECSTBM reset — scroll region back to the full screen. */
export function resetScrollRegion(): string {
    return `${CSI}r`
}

/** IND — index: move down one line, scrolling the region at its bottom. */
export function index(): string {
    return `${ESC}D`
}

/** RI — reverse index: move up one line, scrolling the region at its top. */
export function reverseIndex(): string {
    return `${ESC}M`
}

export function beginSyncUpdate(): string {
    return `${CSI}?2026h`
}

export function endSyncUpdate(): string {
    return `${CSI}?2026l`
}

const ANSI_BG: Record<string, number> = {
    black: 40, red: 41, green: 42, yellow: 43,
    blue: 44, magenta: 45, cyan: 46, white: 47,
    default: 49,
}
