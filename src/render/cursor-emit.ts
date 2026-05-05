import { TermNode, SvtRegionNode } from '../renderer/node.js'
import * as ansi from './ansi.js'

/**
 * After every paint, decide where the real terminal cursor should be
 * and emit ANSI to position it.
 *
 * Priority:
 *   1. Focused node owns a cursor (focused input/textarea publishes one
 *      via cache.cursorScreen) — show it at that position, or hide if
 *      the cursor cell is outside its content viewport. Region cursors
 *      stay dormant in this branch.
 *   2. Otherwise walk the tree for an `<svt-region>` with a registered
 *      cursor (e.g. an embedded terminal mirroring its shell prompt).
 *   3. Otherwise hide the cursor.
 *
 * Always returns a non-empty string — `hideCursor()` on miss — so the
 * caller doesn't need to track transitions.
 */
export function emitFocusCursor(root: TermNode, focused: TermNode | null): string {
    const focusedPos = focused?.getCursorScreenPos()
    if (focusedPos) {
        if (!focusedPos.inViewport) return ansi.hideCursor()
        return ansi.moveTo(focusedPos.x + 1, focusedPos.y + 1) + ansi.showCursor()
    }
    const regionOut = findRegionCursor(root)
    if (regionOut) return regionOut
    return ansi.hideCursor()
}

function findRegionCursor(node: TermNode): string | null {
    if (node instanceof SvtRegionNode) {
        const cursor = node.getCursor()
        if (cursor) {
            const x = node.lastBoxX + cursor.col + 1
            const y = node.lastBoxY + cursor.row + 1
            const visibility = cursor.visible ? ansi.showCursor() : ansi.hideCursor()
            return ansi.moveTo(x, y) + visibility
        }
    }
    for (const child of node.children) {
        const out = findRegionCursor(child)
        if (out) return out
    }
    return null
}
