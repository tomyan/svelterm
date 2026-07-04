/**
 * Modal key routing: an open <dialog> captures keys — Tab cycling traps
 * inside it, Escape closes it — matching browser modal behaviour.
 */

import { TermNode } from '../renderer/node.js'

/** The topmost open <dialog> (last in tree order), or null. */
export function activeModal(root: TermNode): TermNode | null {
    let found: TermNode | null = null
    const walk = (node: TermNode): void => {
        if (node.nodeType === 'element' && node.tag === 'dialog'
            && node.attributes.has('open')) {
            found = node
        }
        for (const child of node.children) walk(child)
    }
    walk(root)
    return found
}

/** Whether `node` is `ancestor` or inside it. */
export function withinSubtree(node: TermNode, ancestor: TermNode): boolean {
    let current: TermNode | null = node
    while (current) {
        if (current === ancestor) return true
        current = current.parent
    }
    return false
}
