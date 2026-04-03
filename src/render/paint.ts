import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'

export function paint(
    root: TermNode,
    buffer: CellBuffer,
    styles?: Map<number, ResolvedStyle>,
    layout?: Map<number, LayoutBox>,
): void {
    paintNode(root, buffer, styles, layout)
}

function paintNode(
    node: TermNode,
    buffer: CellBuffer,
    styles?: Map<number, ResolvedStyle>,
    layout?: Map<number, LayoutBox>,
    inheritedStyle?: ResolvedStyle,
): void {
    if (node.nodeType === 'comment') return

    // Merge: node's own style overrides inherited, but only for non-default values
    const ownStyle = node.nodeType === 'element' ? styles?.get(node.id) : undefined
    const effectiveStyle = mergeStyles(inheritedStyle, ownStyle)
    const box = layout?.get(node.id)

    if (node.nodeType === 'text') {
        const text = node.text ?? ''
        if (!text) return
        const x = box?.x ?? 0
        const y = box?.y ?? 0
        buffer.writeText(x, y, text, {
            fg: effectiveStyle?.fg,
            bg: effectiveStyle?.bg,
            bold: effectiveStyle?.bold,
            italic: effectiveStyle?.italic,
            underline: effectiveStyle?.underline,
            strikethrough: effectiveStyle?.strikethrough,
            dim: effectiveStyle?.dim,
        })
        return
    }

    // Fill background for elements with bg color
    if (node.nodeType === 'element' && box && effectiveStyle?.bg && effectiveStyle.bg !== 'default') {
        for (let row = box.y; row < box.y + box.height; row++) {
            for (let col = box.x; col < box.x + box.width; col++) {
                buffer.setCell(col, row, { bg: effectiveStyle.bg })
            }
        }
    }

    for (const child of node.children) {
        paintNode(child, buffer, styles, layout, effectiveStyle)
    }
}

function mergeStyles(
    inherited: ResolvedStyle | undefined,
    own: ResolvedStyle | undefined,
): ResolvedStyle | undefined {
    if (!inherited) return own
    if (!own) return inherited

    return {
        fg: own.fg !== 'default' ? own.fg : inherited.fg,
        bg: own.bg !== 'default' ? own.bg : inherited.bg,
        bold: own.bold || inherited.bold,
        italic: own.italic || inherited.italic,
        underline: own.underline || inherited.underline,
        strikethrough: own.strikethrough || inherited.strikethrough,
        dim: own.dim || inherited.dim,

        display: own.display,
        flexDirection: own.flexDirection,
        justifyContent: own.justifyContent,
        alignItems: own.alignItems,
        gap: own.gap,
        paddingTop: own.paddingTop,
        paddingRight: own.paddingRight,
        paddingBottom: own.paddingBottom,
        paddingLeft: own.paddingLeft,
        width: own.width,
        height: own.height,
        minWidth: own.minWidth,
        minHeight: own.minHeight,
        maxWidth: own.maxWidth,
        maxHeight: own.maxHeight,
        flexGrow: own.flexGrow,
        flexShrink: own.flexShrink,
    }
}
