/**
 * Minimal ANSI/SGR parser for the <svt-ansi> passthrough element:
 * pre-styled tool output (git diff, ls --color, build logs) renders as
 * styled cells. SGR sequences apply; every other escape sequence is
 * dropped. Content is `pre` — lines split on newline, no wrapping.
 */

export interface AnsiCell {
    char: string
    fg: string
    bg: string
    bold: boolean
    dim: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
    inverse: boolean
}

const SGR_NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

/** Standard xterm palette entries 8–15 (the bright variants). */
const BRIGHT_HEX = ['#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff']

const CUBE_LEVELS = [0, 95, 135, 175, 215, 255]

/** The xterm 256-palette entry as #rrggbb (16–255; 0–15 use names/brights). */
export function palette256(index: number): string {
    if (index < 8) return SGR_NAMES[index]
    if (index < 16) return BRIGHT_HEX[index - 8]
    if (index < 232) {
        const n = index - 16
        const r = CUBE_LEVELS[Math.floor(n / 36)]
        const g = CUBE_LEVELS[Math.floor(n / 6) % 6]
        const b = CUBE_LEVELS[n % 6]
        return hex(r, g, b)
    }
    const grey = 8 + (index - 232) * 10
    return hex(grey, grey, grey)
}

function hex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

interface Style {
    fg: string; bg: string
    bold: boolean; dim: boolean; italic: boolean
    underline: boolean; strikethrough: boolean; inverse: boolean
}

const DEFAULT_STYLE: Style = {
    fg: 'default', bg: 'default',
    bold: false, dim: false, italic: false,
    underline: false, strikethrough: false, inverse: false,
}

const ESCAPE_RE = /\x1b(?:\[([0-9;]*)([a-zA-Z])|\][^\x07\x1b]*(?:\x07|\x1b\\)|[a-zA-Z=><])/

/** Parse ANSI-styled text into lines of styled cells. */
export function parseAnsiText(text: string): AnsiCell[][] {
    const lines: AnsiCell[][] = [[]]
    let style: Style = { ...DEFAULT_STYLE }
    let rest = text

    while (rest.length > 0) {
        const match = ESCAPE_RE.exec(rest)
        const plain = match ? rest.slice(0, match.index) : rest
        for (const char of plain) {
            const line = lines[lines.length - 1]
            if (char === '\n') lines.push([])
            else if (char === '\r') continue
            else if (char === '\t') {
                const stop = (Math.floor(line.length / 8) + 1) * 8
                while (line.length < stop) line.push({ char: ' ', ...style })
            } else {
                line.push({ char, ...style })
            }
        }
        if (!match) break
        if (match[2] === 'm') style = applySgr(style, match[1] ?? '')
        rest = rest.slice(match.index + match[0].length)
    }
    return lines
}

function applySgr(style: Style, params: string): Style {
    const next = { ...style }
    const codes = params === '' ? [0] : params.split(';').map(n => parseInt(n, 10) || 0)
    for (let i = 0; i < codes.length; i++) {
        const code = codes[i]
        if (code === 0) Object.assign(next, DEFAULT_STYLE)
        else if (code === 1) next.bold = true
        else if (code === 2) next.dim = true
        else if (code === 3) next.italic = true
        else if (code === 4) next.underline = true
        else if (code === 7) next.inverse = true
        else if (code === 9) next.strikethrough = true
        else if (code === 22) { next.bold = false; next.dim = false }
        else if (code === 23) next.italic = false
        else if (code === 24) next.underline = false
        else if (code === 27) next.inverse = false
        else if (code === 29) next.strikethrough = false
        else if (code >= 30 && code <= 37) next.fg = SGR_NAMES[code - 30]
        else if (code === 39) next.fg = 'default'
        else if (code >= 40 && code <= 47) next.bg = SGR_NAMES[code - 40]
        else if (code === 49) next.bg = 'default'
        else if (code >= 90 && code <= 97) next.fg = BRIGHT_HEX[code - 90]
        else if (code >= 100 && code <= 107) next.bg = BRIGHT_HEX[code - 100]
        else if (code === 38 || code === 48) {
            const target = code === 38 ? 'fg' : 'bg'
            if (codes[i + 1] === 5 && codes.length > i + 2) {
                next[target] = palette256(codes[i + 2])
                i += 2
            } else if (codes[i + 1] === 2 && codes.length > i + 4) {
                next[target] = hex(codes[i + 2], codes[i + 3], codes[i + 4])
                i += 4
            }
        }
    }
    return next
}

/** Width/height of parsed content (pre semantics — longest line, no wrap). */
export function measureAnsiText(text: string): { width: number; height: number } {
    const lines = parseAnsiText(text)
    return {
        width: lines.reduce((max, line) => Math.max(max, line.length), 0),
        height: lines.length,
    }
}
