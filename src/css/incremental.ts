import { TermNode } from '../renderer/node.js'
import { CSSStyleSheet } from './parser.js'
import { resolveStyles, type ResolvedStyle } from './compute.js'
import type { MediaContext } from './media.js'

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
 * Incrementally resolve styles — only re-resolve dirty nodes,
 * reuse cached styles for clean nodes.
 */
export function resolveStylesIncremental(
    root: TermNode,
    stylesheet: CSSStyleSheet,
    existingStyles: Map<number, ResolvedStyle>,
    dirtyNodes: Set<TermNode>,
    onResolve?: () => void,
    onLayoutAffected?: (node: TermNode) => void,
    media?: MediaContext,
): Map<number, ResolvedStyle> {
    if (dirtyNodes.size === 0) return existingStyles

    // Re-resolve dirty nodes using full resolution on the subtree
    // This is a compromise — we re-resolve the entire tree but only
    // update dirty nodes in the output map
    const freshStyles = resolveStyles(root, stylesheet, media)
    const result = new Map(existingStyles)

    for (const node of dirtyNodes) {
        const newStyle = freshStyles.get(node.id)
        if (!newStyle) continue

        onResolve?.()

        const oldStyle = existingStyles.get(node.id)
        result.set(node.id, newStyle)
        node.cache.resolvedStyle = newStyle

        // Check if layout-affecting properties changed
        if (oldStyle && onLayoutAffected && isLayoutAffecting(oldStyle, newStyle)) {
            onLayoutAffected(node)
        }
    }

    // Also update any NEW nodes (not in existing styles)
    for (const [id, style] of freshStyles) {
        if (!existingStyles.has(id)) {
            result.set(id, style)
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
