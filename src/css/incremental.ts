import { TermNode } from '../renderer/node.js'
import { CSSStyleSheet } from './parser.js'
import { resolveNodeStyle, type ResolvedStyle } from './compute.js'

const LAYOUT_PROPERTIES: (keyof ResolvedStyle)[] = [
    'display', 'flexDirection', 'justifyContent', 'alignItems', 'alignSelf',
    'gap', 'flexGrow', 'flexShrink', 'flexWrap',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    'borderStyle', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
    'position', 'top', 'right', 'bottom', 'left',
    'overflow', 'whiteSpace',
]

/**
 * Truly incremental style resolution — only re-resolve dirty nodes
 * and their descendants (for inheritance). Clean nodes reuse cached styles.
 */
export function resolveStylesIncremental(
    root: TermNode,
    stylesheet: CSSStyleSheet,
    existingStyles: Map<number, ResolvedStyle>,
    dirtyNodes: Set<TermNode>,
    onResolve?: (nodeId: number) => void,
    onLayoutAffected?: (node: TermNode) => void,
): Map<number, ResolvedStyle> {
    if (dirtyNodes.size === 0) return existingStyles

    const result = new Map(existingStyles)

    for (const node of dirtyNodes) {
        if (node.nodeType !== 'element') continue

        const parentStyle = node.parent ? result.get(node.parent.id) : undefined
        const newStyle = resolveNodeStyle(node, stylesheet, parentStyle)
        onResolve?.(node.id)

        const oldStyle = existingStyles.get(node.id)
        result.set(node.id, newStyle)
        node.cache.resolvedStyle = newStyle

        if (oldStyle && onLayoutAffected && isLayoutAffecting(oldStyle, newStyle)) {
            onLayoutAffected(node)
        }

        // Re-resolve descendants — they may inherit from this node
        resolveDescendants(node, stylesheet, result, onResolve)
    }

    return result
}

function resolveDescendants(
    parent: TermNode,
    stylesheet: CSSStyleSheet,
    styles: Map<number, ResolvedStyle>,
    onResolve?: (nodeId: number) => void,
): void {
    for (const child of parent.children) {
        if (child.nodeType !== 'element') continue
        const parentStyle = styles.get(parent.id)
        const newStyle = resolveNodeStyle(child, stylesheet, parentStyle)
        onResolve?.(child.id)
        styles.set(child.id, newStyle)
        child.cache.resolvedStyle = newStyle
        resolveDescendants(child, stylesheet, styles, onResolve)
    }
}

function isLayoutAffecting(oldStyle: ResolvedStyle, newStyle: ResolvedStyle): boolean {
    for (const prop of LAYOUT_PROPERTIES) {
        if (oldStyle[prop] !== newStyle[prop]) return true
    }
    return false
}
