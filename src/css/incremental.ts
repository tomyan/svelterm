import { TermNode } from '../renderer/node.js'
import { CSSStyleSheet } from './parser.js'
import { resolveNode, type ResolvedStyle } from './compute.js'
import { collectVariables } from './variables.js'

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
 * Incremental style resolution — re-resolves dirty nodes and their
 * descendants using the same resolveNode function as full resolution.
 * Variables are collected once from the full tree for consistency.
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

    // Collect variables from the full tree — same as full resolution
    const variables = collectVariables(root, stylesheet)

    // Start with existing styles
    const result = new Map(existingStyles)

    for (const node of dirtyNodes) {
        if (node.nodeType !== 'element') continue

        const oldStyle = existingStyles.get(node.id)

        // Re-resolve this node and all its descendants using the
        // same resolveNode function as full resolution
        resolveNode(node, stylesheet, result, variables)
        onResolve?.(node.id)

        const newStyle = result.get(node.id)
        if (oldStyle && newStyle && onLayoutAffected && isLayoutAffecting(oldStyle, newStyle)) {
            onLayoutAffected(node)
        }
    }

    return result
}

function isLayoutAffecting(oldStyle: ResolvedStyle, newStyle: ResolvedStyle): boolean {
    for (const prop of LAYOUT_PROPERTIES) {
        if (oldStyle[prop] !== newStyle[prop]) return true
    }
    return false
}
