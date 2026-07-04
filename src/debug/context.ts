import type { TermNode } from '../renderer/node.js'
import type { ResolvedStyle } from '../css/compute.js'
import type { LayoutBox } from '../layout/engine.js'

/** Live render state the inspection domains read from. */
export interface DebugContext {
    root: TermNode
    styles: () => Map<number, ResolvedStyle> | undefined
    layout: () => Map<number, LayoutBox> | undefined
    /** Schedule a repaint after a domain mutates the tree. */
    requestRender?: () => void
}

/** Depth-first search for a node by id under the context root. */
export function findNodeById(root: TermNode, id: number): TermNode | null {
    if (root.id === id) return root
    for (const child of root.children) {
        const found = findNodeById(child, id)
        if (found) return found
    }
    return null
}
