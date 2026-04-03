export interface MouseEvent {
    button: 'left' | 'right' | 'middle' | 'scrollUp' | 'scrollDown'
    type: 'press' | 'release'
    col: number  // 0-indexed
    row: number  // 0-indexed
}

const SGR_MOUSE_RE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/

export function parseMouseEvent(data: Buffer): MouseEvent | null {
    const str = data.toString()
    const match = SGR_MOUSE_RE.exec(str)
    if (!match) return null

    const code = parseInt(match[1])
    const col = parseInt(match[2]) - 1  // SGR is 1-indexed
    const row = parseInt(match[3]) - 1
    const type = match[4] === 'M' ? 'press' : 'release'

    return { button: decodeButton(code), type, col, row }
}

function decodeButton(code: number): MouseEvent['button'] {
    const base = code & 3
    if (code & 64) return base === 0 ? 'scrollUp' : 'scrollDown'
    if (base === 0) return 'left'
    if (base === 1) return 'middle'
    if (base === 2) return 'right'
    return 'left'
}
