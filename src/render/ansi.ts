const ESC = '\x1b'
const CSI = `${ESC}[`

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

export function fgColor(color: string): string {
    const code = ANSI_FG[color]
    if (code !== undefined) return `${CSI}${code}m`

    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16)
        const g = parseInt(color.slice(3, 5), 16)
        const b = parseInt(color.slice(5, 7), 16)
        return `${CSI}38;2;${r};${g};${b}m`
    }

    return ''
}

export function bgColor(color: string): string {
    const code = ANSI_BG[color]
    if (code !== undefined) return `${CSI}${code}m`

    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16)
        const g = parseInt(color.slice(3, 5), 16)
        const b = parseInt(color.slice(5, 7), 16)
        return `${CSI}48;2;${r};${g};${b}m`
    }

    return ''
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
    return `${CSI}?1000h${CSI}?1006h` // enable button tracking + SGR mode
}

export function disableMouse(): string {
    return `${CSI}?1006l${CSI}?1000l`
}

const ANSI_BG: Record<string, number> = {
    black: 40, red: 41, green: 42, yellow: 43,
    blue: 44, magenta: 45, cyan: 46, white: 47,
    default: 49,
}
