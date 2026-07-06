/**
 * Mouse-to-caret mapping for editable inputs: converts a click column
 * into a TextBuffer offset using the same content insets paintInput
 * paints with, and counts rapid clicks for double-click word selection.
 */

import type { TermNode } from '../renderer/node.js'
import type { LayoutBox } from '../layout/engine.js'

const MULTI_CLICK_MS = 400

/** Content-left inset as painted: border edge plus left padding. */
function contentInsetLeft(node: TermNode): number {
    const style = node.cache.resolvedStyle
    const borderInset = (style?.borderStyle && style.borderStyle !== 'none') ? 1 : 0
    const padLeft = typeof style?.paddingLeft === 'number' ? style.paddingLeft : 0
    return padLeft + borderInset
}

/** The value offset a click at `col` places the caret at, clamped into the text. */
export function caretOffsetForClick(node: TermNode, box: LayoutBox, col: number): number {
    const contentX = box.x + contentInsetLeft(node)
    const scrollLeft = node.scrollLeft ?? 0
    const length = (node.textBuffer?.text ?? node.attributes.get('value') ?? '').length
    return Math.max(0, Math.min(col - contentX + scrollLeft, length))
}

/** Counts rapid same-cell clicks on one node: 1 single, 2 double, 3 triple… */
export class ClickCounter {
    private last: { id: number; col: number; row: number; time: number; count: number } | null = null

    click(id: number, col: number, row: number, time: number): number {
        const prev = this.last
        const isMulti = prev !== null && prev.id === id
            && prev.col === col && prev.row === row
            && time - prev.time <= MULTI_CLICK_MS
        const count = isMulti ? prev.count + 1 : 1
        this.last = { id, col, row, time, count }
        return count
    }
}
