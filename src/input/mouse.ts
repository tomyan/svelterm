export interface MouseEvent {
    button: 'left' | 'right' | 'middle' | 'scrollUp' | 'scrollDown' | 'scrollLeft' | 'scrollRight' | 'none'
    type: 'press' | 'release' | 'motion' | 'scroll'
    col: number  // 0-indexed
    row: number  // 0-indexed
}

const SGR_MOUSE_RE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/

export function parseMouseEvent(data: Buffer | Uint8Array): MouseEvent | null {
    const str = typeof Buffer !== 'undefined' && Buffer.isBuffer(data)
        ? data.toString()
        : new TextDecoder().decode(data)
    const match = SGR_MOUSE_RE.exec(str)
    if (!match) return null

    const code = parseInt(match[1])
    const col = parseInt(match[2]) - 1
    const row = parseInt(match[3]) - 1

    // Strip modifier bits (shift=4, meta=8, ctrl=16)
    const base = code & ~(4 | 8 | 16)

    // Release
    if (match[4] === 'm') {
        return { button: pressButton(base & 3), type: 'release', col, row }
    }

    // Scroll: codes 64-67
    if (base >= 64 && base <= 67) {
        // Shift modifier (bit 2) on vertical scroll = horizontal scroll
        const hasShift = (code & 4) !== 0
        let button: MouseEvent['button']
        if (base === 64) button = hasShift ? 'scrollLeft' : 'scrollUp'
        else if (base === 65) button = hasShift ? 'scrollRight' : 'scrollDown'
        else if (base === 66) button = 'scrollLeft'
        else button = 'scrollRight'
        return { button, type: 'scroll', col, row }
    }

    // Motion: bit 5 (32)
    if (base & 32) {
        const held = base & ~32 & 3
        const button = held === 3 ? 'none' : pressButton(held)
        return { button, type: 'motion', col, row }
    }

    // Press
    return { button: pressButton(base & 3), type: 'press', col, row }
}

function pressButton(code: number): 'left' | 'right' | 'middle' {
    if (code === 1) return 'middle'
    if (code === 2) return 'right'
    return 'left'
}
