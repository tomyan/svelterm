/**
 * Terminal-style text selection over the painted cell grid. Mouse
 * reporting means the terminal's native selection is off, so svelterm
 * provides its own: drag selects a row-major range, double-click a word,
 * triple-click a line. Selected cells paint inverted; releasing returns
 * the selected text for the clipboard.
 */

import type { CellBuffer } from '../render/buffer.js'

export interface CellPos { col: number; row: number }
export interface SelectionRange { start: CellPos; end: CellPos }

const MULTI_CLICK_MS = 400

/** Row-major ordering: earlier row first, then earlier column. */
function before(a: CellPos, b: CellPos): boolean {
    return a.row < b.row || (a.row === b.row && a.col <= b.col)
}

export class SelectionController {
    private anchor: CellPos | null = null
    private point: CellPos | null = null
    private dragging = false
    private pressed = false
    private lastClick: { pos: CellPos; time: number; count: number } | null = null

    constructor(
        private getBuffer: () => CellBuffer | null,
        private now: () => number = Date.now,
    ) {}

    /** The selected range in row-major order, or null when nothing is selected. */
    range(): SelectionRange | null {
        if (!this.anchor || !this.point) return null
        return before(this.anchor, this.point)
            ? { start: this.anchor, end: this.point }
            : { start: this.point, end: this.anchor }
    }

    /**
     * Left button pressed. Counts multi-clicks: the second quick click on
     * the same cell selects the word, the third the line.
     */
    onPress(col: number, row: number): void {
        this.pressed = true
        const pos = { col, row }
        const previous = this.lastClick
        const isMulti = previous
            && previous.pos.col === col && previous.pos.row === row
            && this.now() - previous.time <= MULTI_CLICK_MS
        const count = isMulti ? previous.count + 1 : 1
        this.lastClick = { pos, time: this.now(), count }

        if (count === 2) {
            this.selectWord(pos)
        } else if (count >= 3) {
            this.selectLine(pos)
        } else {
            // A fresh press clears any old selection; dragging re-creates one
            this.anchor = pos
            this.point = null
            this.dragging = false
        }
    }

    /** Pointer moved with the left button held: extend the selection. */
    onMotion(col: number, row: number): boolean {
        if (!this.pressed || !this.anchor) return false
        if (!this.dragging && this.anchor.col === col && this.anchor.row === row) return false
        this.dragging = true
        const moved = this.point?.col !== col || this.point?.row !== row
        this.point = { col, row }
        return moved
    }

    /**
     * Left button released. Returns the selected text (for the clipboard)
     * when a selection exists; the highlight stays until the next press.
     */
    onRelease(): string | null {
        this.pressed = false
        this.dragging = false
        const range = this.range()
        if (!range) return null
        return this.extractText(range)
    }

    /** Drop the selection; returns whether anything was cleared. */
    clear(): boolean {
        const had = this.anchor !== null && this.point !== null
        this.anchor = null
        this.point = null
        this.dragging = false
        return had
    }

    private selectWord(pos: CellPos): void {
        const text = this.rowText(pos.row)
        if (pos.col >= text.length || /\s/.test(text[pos.col] ?? ' ')) return
        let start = pos.col
        let end = pos.col
        while (start > 0 && !/\s/.test(text[start - 1])) start--
        while (end < text.length - 1 && !/\s/.test(text[end + 1])) end++
        this.anchor = { col: start, row: pos.row }
        this.point = { col: end, row: pos.row }
    }

    private selectLine(pos: CellPos): void {
        const buffer = this.getBuffer()
        const width = buffer?.width ?? 0
        this.anchor = { col: 0, row: pos.row }
        this.point = { col: Math.max(0, width - 1), row: pos.row }
    }

    private rowText(row: number): string {
        const buffer = this.getBuffer()
        if (!buffer) return ''
        let text = ''
        for (let col = 0; ; col++) {
            const cell = buffer.getCell(col, row)
            if (!cell) break
            text += cell.char || ' '
        }
        return text
    }

    private extractText(range: SelectionRange): string {
        const lines: string[] = []
        for (let row = range.start.row; row <= range.end.row; row++) {
            const text = this.rowText(row)
            const from = row === range.start.row ? range.start.col : 0
            const to = row === range.end.row ? range.end.col : text.length - 1
            lines.push(text.slice(from, to + 1).replace(/\s+$/, ''))
        }
        return lines.join('\n')
    }
}

/** Invert the cells covered by the selection so it reads as highlighted. */
export function applySelectionOverlay(buffer: CellBuffer, range: SelectionRange | null): void {
    if (!range) return
    for (let row = range.start.row; row <= range.end.row; row++) {
        const from = row === range.start.row ? range.start.col : 0
        let col = from
        while (true) {
            const cell = buffer.getCell(col, row)
            if (!cell) break
            if (row === range.end.row && col > range.end.col) break
            buffer.setCell(col, row, { inverse: !cell.inverse })
            col++
        }
    }
}
