import { TermNode } from '../renderer/node.js'
import { LayoutBox } from '../layout/engine.js'

export function hitTest(
    root: TermNode,
    layout: Map<number, LayoutBox>,
    col: number,
    row: number,
): TermNode | null {
    return hitTestNode(root, layout, col, row)
}

function hitTestNode(
    node: TermNode,
    layout: Map<number, LayoutBox>,
    col: number,
    row: number,
): TermNode | null {
    if (node.nodeType !== 'element') return null

    const box = layout.get(node.id)
    if (!box) return null
    if (!isInBox(col, row, box)) return null

    // Check children deepest-first (last child = highest z)
    for (let i = node.children.length - 1; i >= 0; i--) {
        const hit = hitTestNode(node.children[i], layout, col, row)
        if (hit) return hit
    }

    return node
}

function isInBox(col: number, row: number, box: LayoutBox): boolean {
    return col >= box.x && col < box.x + box.width
        && row >= box.y && row < box.y + box.height
}
