import { TermNode } from '../renderer/node.js'

const LABELLABLE = new Set(['input', 'select', 'textarea', 'button'])

/**
 * The form control a click on `node` should activate through its
 * <label>, per browser behaviour: walk up to the nearest label, then
 * resolve its `for="id"` reference or first labellable descendant.
 * Returns null when no label or no control is involved.
 */
export function labelledControl(node: TermNode): TermNode | null {
    const label = nearestLabel(node)
    if (!label) return null

    const forId = label.attributes.get('for')
    if (forId) return findById(treeRoot(label), forId)
    return findControl(label)
}

function nearestLabel(node: TermNode): TermNode | null {
    let current: TermNode | null = node
    while (current) {
        if (current.tag === 'label') return current
        current = current.parent
    }
    return null
}

function findControl(scope: TermNode): TermNode | null {
    for (const child of scope.children) {
        if (child.nodeType !== 'element') continue
        if (LABELLABLE.has(child.tag ?? '')) return child
        const nested = findControl(child)
        if (nested) return nested
    }
    return null
}

function findById(scope: TermNode, id: string): TermNode | null {
    if (scope.nodeType === 'element' && scope.attributes.get('id') === id) return scope
    for (const child of scope.children) {
        const found = findById(child, id)
        if (found) return found
    }
    return null
}

function treeRoot(node: TermNode): TermNode {
    let root = node
    while (root.parent) root = root.parent
    return root
}
