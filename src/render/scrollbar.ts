import { CellBuffer } from './buffer.js'

const THUMB_CHAR = '┃'
const SCROLLBAR_COLOR = { r: 180, g: 180, b: 180 }

/**
 * Render a scrollbar overlay on the rightmost column of the viewport.
 * Uses color interpolation for smooth fade animation.
 */
export function renderScrollbar(
    buffer: CellBuffer,
    viewportX: number,
    viewportY: number,
    viewportWidth: number,
    viewportHeight: number,
    contentHeight: number,
    scrollTop: number,
    opacity: number,
): void {
    if (contentHeight <= viewportHeight || opacity <= 0) return

    const col = viewportX + viewportWidth - 1
    const thumbSize = Math.max(1, Math.round(viewportHeight * (viewportHeight / contentHeight)))
    const maxScroll = contentHeight - viewportHeight
    const thumbPos = Math.round((scrollTop / maxScroll) * (viewportHeight - thumbSize))

    for (let row = 0; row < thumbSize; row++) {
        const y = viewportY + thumbPos + row
        if (y < viewportY || y >= viewportY + viewportHeight) continue
        const existing = buffer.getCell(col, y)
        const bg = parseColor(existing?.bg ?? 'default')
        const fg = lerpColor(bg, SCROLLBAR_COLOR, opacity)
        buffer.setCell(col, y, {
            char: THUMB_CHAR,
            fg: toHex(fg),
            dim: false,
        })
    }
}

interface RGB { r: number; g: number; b: number }

function parseColor(color: string): RGB {
    if (color.startsWith('#')) {
        const hex = color.length === 4
            ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
            : color
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16),
        }
    }
    // Default/unknown — assume dark background
    return { r: 13, g: 17, b: 23 }
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
    return {
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t),
    }
}

function toHex(c: RGB): string {
    return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`
}

function hex(n: number): string {
    return n.toString(16).padStart(2, '0')
}
