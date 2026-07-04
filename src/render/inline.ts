/**
 * Inline-mode screen driver. The app renders into the main buffer at the
 * shell's cursor position; rows above the render origin belong to the
 * terminal's scrollback and are never touched again. All cursor movement
 * is relative — the origin's absolute position is unknown by design.
 *
 * Growth emits real newlines at the bottom row (LF scrolls where CUD
 * cannot); shrinking erases to end of screen; archiving (`releaseTop`)
 * just moves the comparison window down — the released rows are already
 * on the terminal exactly as they should stay.
 */

import { CellBuffer, cellsEqual, type Cell } from './buffer.js'
import * as ansi from './ansi.js'
import { stringWidth } from '../layout/unicode.js'

const CSI = '\x1b['

export class InlineScreen {
    /** Last painted content, padded with blanks to `physicalRows`. */
    private prev: CellBuffer | null = null
    /** Lines the zone has realised on the terminal. */
    private physicalRows = 0
    /** Rows the last buffer actually occupied (≤ physicalRows). */
    private contentHeight = 0
    /** Cursor position relative to the live-zone origin. */
    private cursorRow = 0
    /** -1 when unknown (wrap-pending after writing the last column). */
    private cursorCol = 0
    /** 1-based screen row of zone row 0, from a CPR query; null = unknown. */
    private originRow: number | null = null

    /** ANSI that makes the terminal's live zone match `next`. */
    render(next: CellBuffer): string {
        const parts: string[] = []

        if (this.prev && this.prev.width !== next.width) {
            // Width changed: the terminal may have rewrapped our rows.
            // Erase and repaint the whole zone in place — best effort.
            parts.push(this.moveRow(0), '\r', `${CSI}0J`)
            this.cursorCol = 0
            this.prev = null
        }

        if (next.height > this.physicalRows) parts.push(this.grow(next.height))
        if (next.height < this.contentHeight) parts.push(this.eraseBelow(next.height))

        let lastStyle: string | null = null
        for (let row = 0; row < next.height; row++) {
            for (let col = 0; col < next.width; col++) {
                const cell = next.getCell(col, row)!
                const prevCell = this.prev?.getCell(col, row)
                if (prevCell && cellsEqual(prevCell, cell)) continue
                // Continuation cell of a wide glyph — the glyph writes it
                if (cell.char === '') continue

                if (this.cursorRow !== row || this.cursorCol !== col) {
                    parts.push(this.moveRow(row), `${CSI}${col + 1}G`)
                }
                const styleCode = buildStyleCode(cell)
                if (styleCode !== lastStyle) {
                    parts.push(ansi.resetStyle(), styleCode)
                    lastStyle = styleCode
                }
                parts.push(cell.char)
                const advance = Math.max(1, stringWidth(cell.char))
                this.cursorCol = col + advance >= next.width ? -1 : col + advance
            }
        }
        if (lastStyle !== null) parts.push(ansi.resetStyle())

        this.prev = padToHeight(next, this.physicalRows)
        this.contentHeight = next.height
        return parts.join('')
    }

    /** Record where the zone starts on screen (1-based, from CPR). */
    setOriginRow(row: number): void {
        this.originRow = row
    }

    /** The cursor's current row within the zone (for CPR origin math). */
    cursorZoneRow(): number {
        return Math.max(0, this.cursorRow)
    }

    /**
     * Map a 0-based screen row (mouse coordinates) to a zone row, or
     * null when unknown or outside the live content. Growth past the
     * screen bottom scrolls the zone up, so the effective origin is
     * clamped to keep the zone's bottom on screen.
     */
    screenRowToZone(screenRow: number, screenHeight: number): number | null {
        if (this.originRow === null) return null
        const effectiveOrigin = Math.min(this.originRow, screenHeight - this.physicalRows + 1)
        const zoneRow = screenRow - (effectiveOrigin - 1)
        if (zoneRow < 0 || zoneRow >= this.contentHeight) return null
        return zoneRow
    }

    /**
     * Forget the zone entirely — after a suspend the shell owned the
     * screen, so the next render starts a fresh zone at the cursor.
     */
    reset(): void {
        this.prev = null
        this.physicalRows = 0
        this.contentHeight = 0
        this.cursorRow = 0
        this.cursorCol = 0
        this.originRow = null
    }

    /** Hand the top `n` rows to the terminal's scrollback. */
    releaseTop(n: number): void {
        if (n <= 0) return
        const count = Math.min(n, this.contentHeight)
        if (this.prev) this.prev = dropTopRows(this.prev, count)
        this.physicalRows -= count
        this.contentHeight -= count
        this.cursorRow -= count
        if (this.originRow !== null) this.originRow += count
    }

    /** Place the terminal cursor at live-zone coordinates. */
    moveCursorTo(col: number, row: number): string {
        const out = this.moveRow(row) + `${CSI}${col + 1}G`
        this.cursorCol = col
        return out
    }

    /** Leave the cursor on a fresh line after the content. */
    finish(): string {
        let out: string
        if (this.contentHeight < this.physicalRows) {
            out = this.moveRow(this.contentHeight) + '\r'
        } else {
            out = this.moveRow(Math.max(0, this.physicalRows - 1)) + '\r\n'
            this.cursorRow = this.physicalRows
        }
        this.cursorCol = 0
        return out + ansi.showCursor()
    }

    /** Relative row movement, tracking the new position. */
    private moveRow(row: number): string {
        const delta = row - this.cursorRow
        this.cursorRow = row
        if (delta === 0) return ''
        return delta > 0 ? `${CSI}${delta}B` : `${CSI}${-delta}A`
    }

    /** Realise new physical lines with LF so the terminal scrolls. */
    private grow(height: number): string {
        const parts: string[] = []
        if (this.physicalRows > 0) parts.push(this.moveRow(this.physicalRows - 1))
        parts.push('\r')
        const count = this.physicalRows === 0 ? height - 1 : height - this.physicalRows
        for (let i = 0; i < count; i++) parts.push('\n')
        this.cursorRow = height - 1
        this.cursorCol = 0
        this.physicalRows = height
        this.prev = this.prev && padToHeight(this.prev, height)
        return parts.join('')
    }

    /**
     * Blank everything below `height`. The physical lines stay realised
     * (as empties) so regrowth reuses them instead of scrolling new ones.
     */
    private eraseBelow(height: number): string {
        const out = this.moveRow(height) + '\r' + `${CSI}0J`
        this.cursorCol = 0
        if (this.prev) this.prev = blankBelow(this.prev, height)
        return out
    }
}

function padToHeight(buffer: CellBuffer, height: number): CellBuffer {
    if (buffer.height >= height) return buffer
    const next = new CellBuffer(buffer.width, height)
    copyRows(buffer, next, 0, buffer.height, 0)
    return next
}

function dropTopRows(buffer: CellBuffer, count: number): CellBuffer {
    const next = new CellBuffer(buffer.width, Math.max(0, buffer.height - count))
    copyRows(buffer, next, count, buffer.height, -count)
    return next
}

function blankBelow(buffer: CellBuffer, fromRow: number): CellBuffer {
    const next = new CellBuffer(buffer.width, buffer.height)
    copyRows(buffer, next, 0, Math.min(fromRow, buffer.height), 0)
    return next
}

function copyRows(from: CellBuffer, to: CellBuffer, start: number, end: number, offset: number): void {
    for (let row = start; row < end; row++) {
        for (let col = 0; col < from.width; col++) {
            const cell = from.getCell(col, row)
            if (cell) to.setCell(col, row + offset, cell)
        }
    }
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
