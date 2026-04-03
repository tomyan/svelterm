import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'
import { wrapText } from '../layout/text.js'

/**
 * Repaint only specific nodes' cells in the buffer.
 * Clears the old area and writes the new content.
 */
export function paintNodes(
    nodes: Set<TermNode>,
    buffer: CellBuffer,
    styles: Map<number, ResolvedStyle>,
    layout: Map<number, LayoutBox>,
    root: TermNode,
): void {
    for (const node of nodes) {
        const box = layout.get(node.id)
        if (!box) continue

        // Clear the old cached area if it exists and differs
        const oldBox = node.cache.layoutBox
        if (oldBox) {
            clearArea(buffer, oldBox)
        }

        if (node.nodeType === 'text') {
            paintTextNode(node, buffer, box, styles)
        }
    }
}

function clearArea(buffer: CellBuffer, box: LayoutBox): void {
    for (let row = box.y; row < box.y + box.height; row++) {
        for (let col = box.x; col < box.x + box.width; col++) {
            buffer.setCell(col, row, { char: ' ', fg: 'default', bg: 'default', bold: false, italic: false, underline: false, strikethrough: false, dim: false })
        }
    }
}

function paintTextNode(
    node: TermNode,
    buffer: CellBuffer,
    box: LayoutBox,
    styles: Map<number, ResolvedStyle>,
): void {
    const text = node.text ?? ''
    if (!text) return

    // Resolve inherited visuals from ancestors
    const visuals = resolveInheritedVisuals(node, styles)

    const lines = wrapText(text, box.width > 0 ? box.width : buffer.width)

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx]
        const y = box.y + lineIdx
        for (let i = 0; i < line.length; i++) {
            buffer.setCell(box.x + i, y, {
                char: line[i],
                fg: visuals.fg,
                bg: visuals.bg,
                bold: visuals.bold,
                italic: visuals.italic,
                underline: visuals.underline,
                strikethrough: visuals.strikethrough,
                dim: visuals.dim,
            })
        }
    }
}

function resolveInheritedVisuals(node: TermNode, styles: Map<number, ResolvedStyle>): {
    fg: string; bg: string; bold: boolean; italic: boolean;
    underline: boolean; strikethrough: boolean; dim: boolean
} {
    const result = { fg: 'default', bg: 'default', bold: false, italic: false, underline: false, strikethrough: false, dim: false }

    // Walk ancestors and accumulate inheritable properties
    let current: TermNode | null = node.parent
    while (current) {
        const style = styles.get(current.id)
        if (style) {
            if (result.fg === 'default' && style.fg !== 'default') result.fg = style.fg
            if (!result.bold && style.bold) result.bold = true
            if (!result.italic && style.italic) result.italic = true
            if (!result.underline && style.underline) result.underline = true
            if (!result.strikethrough && style.strikethrough) result.strikethrough = true
            if (!result.dim && style.dim) result.dim = true
        }
        current = current.parent
    }

    return result
}
