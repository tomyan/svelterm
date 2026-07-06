import { TermNode, childrenWithPseudos } from '../renderer/node.js'
import { LayoutBox } from '../layout/engine.js'

export function hitTest(
    root: TermNode,
    layout: Map<number, LayoutBox>,
    col: number,
    row: number,
): TermNode | null {
    return hitTestNode(root, layout, col, row, 0, 0)
}

function hitTestNode(
    node: TermNode,
    layout: Map<number, LayoutBox>,
    col: number,
    row: number,
    scrollX: number,
    scrollY: number,
): TermNode | null {
    if (node.nodeType !== 'element') return null

    const box = layout.get(node.id)
    if (!box) return null

    // Apply accumulated scroll offset to convert screen coords to layout coords
    const layoutCol = col + scrollX
    const layoutRow = row + scrollY
    if (!isInBox(layoutCol, layoutRow, box)) return null

    // Accumulate this node's scroll offset for children
    const childScrollX = scrollX + node.scrollLeft
    const childScrollY = scrollY + node.scrollTop

    // Check children deepest-first (last child = highest z)
    for (let i = node.children.length - 1; i >= 0; i--) {
        const hit = hitTestNode(node.children[i], layout, col, row, childScrollX, childScrollY)
        if (hit) return hit
    }

    // A union box (inline element in an IFC) bounds its fragments but
    // only occupies cells its descendants' content covers — ragged
    // line-end cells fall through to the container.
    if (box.union && !occupiesCell(node, layout, layoutCol, layoutRow)) return null

    return node
}

/** Whether the node's own content covers the cell: fragment boxes only
 * their line rectangles, union boxes only where a descendant does,
 * everything else its whole rect. */
function occupiesCell(
    node: TermNode,
    layout: Map<number, LayoutBox>,
    col: number,
    row: number,
): boolean {
    if (node.nodeType === 'comment') return false
    const box = layout.get(node.id)
    if (!box || !isInBox(col, row, box)) return false
    if (box.union) {
        return childrenWithPseudos(node).some(child => occupiesCell(child, layout, col, row))
    }
    if (box.fragments) {
        return box.fragments.some(f =>
            row === box.y + f.y && col >= box.x + f.x && col < box.x + f.x + f.width)
    }
    return true
}

function isInBox(col: number, row: number, box: LayoutBox): boolean {
    return col >= box.x && col < box.x + box.width
        && row >= box.y && row < box.y + box.height
}
