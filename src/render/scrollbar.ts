import { CellBuffer } from './buffer.js'

const V_THUMB = '┃'
const H_THUMB = '▁'
const SCROLLBAR_COLOR = { r: 180, g: 180, b: 180 }

/**
 * Render a vertical scrollbar overlay on the rightmost column.
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
            char: V_THUMB,
            fg: toHex(fg),
            dim: false,
        })
    }
}

/**
 * Render a horizontal scrollbar overlay on the bottom row.
 */
export function renderHScrollbar(
    buffer: CellBuffer,
    viewportX: number,
    viewportY: number,
    viewportWidth: number,
    viewportHeight: number,
    contentWidth: number,
    scrollLeft: number,
    opacity: number,
): void {
    if (contentWidth <= viewportWidth || opacity <= 0) return

    const row = viewportY + viewportHeight - 1
    const thumbSize = Math.max(1, Math.round(viewportWidth * (viewportWidth / contentWidth)))
    const maxScroll = contentWidth - viewportWidth
    const thumbPos = Math.round((scrollLeft / maxScroll) * (viewportWidth - thumbSize))

    for (let col = 0; col < thumbSize; col++) {
        const x = viewportX + thumbPos + col
        if (x < viewportX || x >= viewportX + viewportWidth) continue
        const existing = buffer.getCell(x, row)
        const bg = parseColor(existing?.bg ?? 'default')
        const fg = lerpColor(bg, SCROLLBAR_COLOR, opacity)
        buffer.setCell(x, row, {
            char: H_THUMB,
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
