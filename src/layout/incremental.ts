import { TermNode } from '../renderer/node.js'
import { ResolvedStyle } from '../css/compute.js'
import { computeLayout, LayoutBox } from './engine.js'

/**
 * Incrementally re-layout only dirty subtrees.
 * Falls back to full layout when dirty nodes affect auto-sized ancestors.
 */
export function computeLayoutIncremental(
    root: TermNode,
    styles: Map<number, ResolvedStyle>,
    existingLayout: Map<number, LayoutBox>,
    dirtyNodes: Set<TermNode>,
    availWidth: number,
    availHeight: number,
    onLayout?: () => void,
): Map<number, LayoutBox> {
    if (dirtyNodes.size === 0) return existingLayout

    // Check if any dirty node has an auto-sized ancestor — if so, full re-layout
    // because the size change may propagate up
    const needsFullLayout = [...dirtyNodes].some(node => hasAutoSizedAncestor(node, styles))

    if (needsFullLayout) {
        onLayout?.()
        return computeLayout(root, styles, availWidth, availHeight)
    }

    // All dirty nodes are within fixed-size containers — only re-layout those subtrees
    const result = new Map(existingLayout)

    for (const dirtyNode of dirtyNodes) {
        const boundary = findLayoutBoundary(dirtyNode, styles)
        const boundaryBox = existingLayout.get(boundary.id)
        if (!boundaryBox) continue

        onLayout?.()
        const subtreeLayout = computeLayout(
            boundary, styles,
            boundaryBox.width, boundaryBox.height,
        )

        // Merge subtree layout into result, adjusting positions
        for (const [id, box] of subtreeLayout) {
            result.set(id, {
                x: box.x + boundaryBox.x,
                y: box.y + boundaryBox.y,
                width: box.width,
                height: box.height,
            })
        }
        // The boundary itself keeps its original position
        result.set(boundary.id, boundaryBox)
    }

    return result
}

function hasAutoSizedAncestor(node: TermNode, styles: Map<number, ResolvedStyle>): boolean {
    let current = node.parent
    while (current) {
        const style = styles.get(current.id)
        if (!style || style.width === null || style.height === null) return true
        current = current.parent
    }
    return false
}

function findLayoutBoundary(node: TermNode, styles: Map<number, ResolvedStyle>): TermNode {
    let current = node.parent
    while (current?.parent) {
        const style = styles.get(current.id)
        if (style && style.width !== null && style.height !== null) return current
        current = current.parent
    }
    return current ?? node
}
