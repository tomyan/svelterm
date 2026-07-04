import { Cell, CellBuffer, cellsEqual } from './buffer.js'
import * as ansi from './ansi.js'

export interface VerticalShift {
    /** Rows content moved: +N = scrolled up (content moved toward row 0). */
    delta: number
    /** Row indices in `next` that are newly revealed (must be repainted). */
    enteringRows: number[]
}

/**
 * Detect whether `next` is `prev` translated vertically by ±N rows over
 * the full width — a scroll. Returns null unless the retained rows match
 * exactly and at least one row is reused (so a scroll command saves work).
 */
export function detectVerticalShift(prev: CellBuffer, next: CellBuffer): VerticalShift | null {
    if (prev.width !== next.width || prev.height !== next.height) return null
    const height = next.height
    for (let delta = 1; delta < height; delta++) {
        if (rowsMatchShifted(prev, next, delta)) {
            return { delta, enteringRows: range(height - delta, height) }
        }
        if (rowsMatchShifted(prev, next, -delta)) {
            return { delta: -delta, enteringRows: range(0, delta) }
        }
    }
    return null
}

/**
 * Do next's retained rows equal prev shifted up (delta>0) or down
 * (delta<0)? next row R comes from prev row R+delta; rows whose source
 * falls off the buffer are the entering rows and aren't compared.
 */
function rowsMatchShifted(prev: CellBuffer, next: CellBuffer, delta: number): boolean {
    const height = next.height
    let comparedAny = false
    for (let row = 0; row < height; row++) {
        const sourceRow = row + delta
        if (sourceRow < 0 || sourceRow >= height) continue // an entering row
        comparedAny = true
        if (!rowsEqual(prev, next, sourceRow, row)) return false
    }
    return comparedAny
}

function rowsEqual(a: CellBuffer, b: CellBuffer, aRow: number, bRow: number): boolean {
    for (let col = 0; col < a.width; col++) {
        const ca = a.getCell(col, aRow)
        const cb = b.getCell(col, bRow)
        if (!ca || !cb || !cellsEqual(ca, cb)) return false
    }
    return true
}

function range(start: number, end: number): number[] {
    const out: number[] = []
    for (let i = start; i < end; i++) out.push(i)
    return out
}

export function diffBuffers(prev: CellBuffer | null, next: CellBuffer): string {
    // Whole-screen scroll: let the terminal shift rows via DECSTBM instead
    // of rewriting every cell. Only the entering rows are painted.
    if (prev) {
        const shift = detectVerticalShift(prev, next)
        if (shift) return scrollDiff(next, shift)
    }

    const parts: string[] = []
    let lastStyle: string | null = null
    let currentHyperlink: string | undefined = undefined

    for (let row = 0; row < next.height; row++) {
        for (let col = 0; col < next.width; col++) {
            const cell = next.getCell(col, row)!
            const prevCell = prev?.getCell(col, row)

            if (prevCell && cellsEqual(prevCell, cell)) continue
            // Continuation cell of a wide glyph — the glyph writes it
            if (cell.char === '') continue

            parts.push(ansi.moveTo(col + 1, row + 1))

            const styleCode = buildStyleCode(cell)
            if (styleCode !== lastStyle) {
                parts.push(ansi.resetStyle())
                parts.push(styleCode)
                lastStyle = styleCode
            }

            if (cell.hyperlink !== currentHyperlink) {
                if (currentHyperlink) parts.push(ansi.hyperlinkClose())
                if (cell.hyperlink) parts.push(ansi.hyperlinkOpen(cell.hyperlink))
                currentHyperlink = cell.hyperlink
            }

            parts.push(cell.char)
        }
    }

    if (currentHyperlink) parts.push(ansi.hyperlinkClose())
    if (parts.length > 0) parts.push(ansi.resetStyle())

    return parts.join('')
}

/**
 * Emit a scroll via DECSTBM: set the region to the full height, index
 * (or reverse-index) |delta| times to shift the retained rows, then
 * paint only the entering rows. Resets the region afterwards.
 */
function scrollDiff(next: CellBuffer, shift: VerticalShift): string {
    const parts: string[] = [ansi.setScrollRegion(1, next.height)]
    const count = Math.abs(shift.delta)
    if (shift.delta > 0) {
        // Scrolled up: cursor to bottom, index N times (each scrolls up)
        parts.push(ansi.moveTo(1, next.height))
        for (let i = 0; i < count; i++) parts.push(ansi.index())
    } else {
        // Scrolled down: cursor to top, reverse-index N times
        parts.push(ansi.moveTo(1, 1))
        for (let i = 0; i < count; i++) parts.push(ansi.reverseIndex())
    }
    parts.push(ansi.resetScrollRegion())
    parts.push(paintRows(next, shift.enteringRows))
    return parts.join('')
}

/** Paint the given rows in full (used for the entering rows of a scroll). */
function paintRows(next: CellBuffer, rows: number[]): string {
    const parts: string[] = []
    let lastStyle: string | null = null
    let currentHyperlink: string | undefined = undefined
    for (const row of rows) {
        for (let col = 0; col < next.width; col++) {
            const cell = next.getCell(col, row)!
            if (cell.char === '') continue
            parts.push(ansi.moveTo(col + 1, row + 1))
            const styleCode = buildStyleCode(cell)
            if (styleCode !== lastStyle) {
                parts.push(ansi.resetStyle(), styleCode)
                lastStyle = styleCode
            }
            if (cell.hyperlink !== currentHyperlink) {
                if (currentHyperlink) parts.push(ansi.hyperlinkClose())
                if (cell.hyperlink) parts.push(ansi.hyperlinkOpen(cell.hyperlink))
                currentHyperlink = cell.hyperlink
            }
            parts.push(cell.char)
        }
    }
    if (currentHyperlink) parts.push(ansi.hyperlinkClose())
    if (parts.length > 0) parts.push(ansi.resetStyle())
    return parts.join('')
}

function buildStyleCode(cell: Cell): string {
    const parts: string[] = []
    if (cell.fg !== 'default') parts.push(ansi.fgColor(cell.fg))
    if (cell.bg !== 'default') parts.push(ansi.bgColor(cell.bg))
    if (cell.bold) parts.push(ansi.bold())
    if (cell.dim) parts.push(ansi.dim())
    if (cell.italic) parts.push(ansi.italic())
    if (cell.underline) parts.push(ansi.underline())
    if (cell.strikethrough) parts.push(ansi.strikethrough())
    if (cell.inverse) parts.push(ansi.inverse())
    return parts.join('')
}
