/**
 * Textarea paint support. The value itself renders as a normal text
 * child (UA `white-space: pre` gives one line box per newline, the
 * overflow machinery clips and scrolls). Paint adds, for the focused
 * element: scroll-follow so the caret stays inside the content box,
 * the hardware-cursor position, and the selection inversion.
 */

import type { TermNode } from '../renderer/node.js'
import type { ResolvedStyle } from '../css/compute.js'
import type { LayoutBox } from '../layout/engine.js'
import type { CellBuffer } from './buffer.js'
import { stringWidth } from '../layout/unicode.js'
import { paintGeneration } from './generation.js'

interface Rect { x: number; y: number; width: number; height: number }

function contentBox(box: LayoutBox, style: ResolvedStyle | undefined): Rect {
    const border = (style?.borderStyle && style.borderStyle !== 'none') ? 1 : 0
    const pad = (v: number | string | undefined): number => typeof v === 'number' ? v : 0
    const left = border + pad(style?.paddingLeft)
    const right = border + pad(style?.paddingRight)
    const top = border + pad(style?.paddingTop)
    const bottom = border + pad(style?.paddingBottom)
    return {
        x: box.x + left,
        y: box.y + top,
        width: Math.max(0, box.width - left - right),
        height: Math.max(0, box.height - top - bottom),
    }
}

function within(x: number, y: number, rect: Rect | null): boolean {
    if (!rect) return true
    return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

/** Pre-children: follow the caret with scrollTop/scrollLeft and publish
 *  the hardware-cursor cell. Runs only for the focused element. */
export function syncTextareaView(
    node: TermNode, box: LayoutBox, style: ResolvedStyle | undefined, clip: Rect | null,
): void {
    const buf = node.textBuffer
    if (!buf || !node.attributes.has('data-focused')) return
    const content = contentBox(box, style)
    if (content.width <= 0 || content.height <= 0) return

    const { row, col } = buf.lineCol()
    const line = buf.text.split('\n')[row] ?? ''
    const cursorCells = stringWidth(line.substring(0, col))

    let top = node.scrollTop
    if (row < top) top = row
    if (row >= top + content.height) top = row - content.height + 1
    node.scrollTop = Math.max(0, top)

    let left = node.scrollLeft
    if (cursorCells < left) left = cursorCells
    if (cursorCells >= left + content.width) left = cursorCells - content.width + 1
    node.scrollLeft = Math.max(0, left)

    const x = content.x + cursorCells - node.scrollLeft
    const y = content.y + row - node.scrollTop
    const inViewport = within(x, y, { ...content, width: content.width + 1 }) && within(x, y, clip)
    node.cache.cursorScreen = { x, y, inViewport, generation: paintGeneration() }
}

/** Post-children: invert the visible cells the selection covers. */
export function paintTextareaSelection(
    node: TermNode, buffer: CellBuffer, box: LayoutBox,
    style: ResolvedStyle | undefined, clip: Rect | null,
): void {
    const buf = node.textBuffer
    if (!buf || !node.attributes.has('data-focused')) return
    const range = buf.selectionRange()
    if (!range) return
    const content = contentBox(box, style)

    const lines = buf.text.split('\n')
    let offset = 0
    for (let row = 0; row < lines.length; row++) {
        const line = lines[row]
        const y = content.y + row - node.scrollTop
        if (y >= content.y && y < content.y + content.height) {
            const from = Math.max(range.start, offset)
            const to = Math.min(range.end, offset + line.length)
            for (let unit = from; unit < to; unit++) {
                const x = content.x + (unit - offset) - node.scrollLeft
                if (!within(x, y, content) || !within(x, y, clip)) continue
                if (buffer.getCell(x, y)) buffer.setCell(x, y, { inverse: true })
            }
        }
        offset += line.length + 1
    }
}
