import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'
import { renderBorder } from './border.js'
import { paintTextContent } from './paint-text.js'

/**
 * Repaint only specific nodes' cells in the buffer.
 * Clears the old area and writes the new content.
 * Handles text-align, text-overflow, and white-space from ancestors.
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

        const oldBox = node.cache.layoutBox
        if (oldBox) clearArea(buffer, oldBox)

        if (node.nodeType === 'text') {
            paintTextShared(node, buffer, box, styles, layout)
        } else if (node.nodeType === 'element') {
            paintElementNode(node, buffer, box, styles, layout)
        }
    }
}

function paintElementNode(
    node: TermNode,
    buffer: CellBuffer,
    box: LayoutBox,
    styles: Map<number, ResolvedStyle>,
    layout: Map<number, LayoutBox>,
): void {
    const style = styles.get(node.id)
    if (!style || style.display === 'none') return

    // Background fill
    const visuals = resolveInheritedVisuals(node, styles)
    // Element's own style overrides inherited
    const bg = style.bg !== 'default' ? style.bg : visuals.bg
    if (bg !== 'default') {
        for (let row = box.y; row < box.y + box.height; row++) {
            for (let col = box.x; col < box.x + box.width; col++) {
                buffer.setCell(col, row, { bg })
            }
        }
    }

    // Border
    if (style.borderStyle !== 'none') {
        renderBorder(buffer, box, style)
    }

    // Repaint text children
    for (const child of node.children) {
        const childBox = layout.get(child.id)
        if (!childBox) continue
        if (child.nodeType === 'text') {
            paintTextShared(child, buffer, childBox, styles, layout)
        } else if (child.nodeType === 'element') {
            paintElementNode(child, buffer, childBox, styles, layout)
        }
    }
}

function paintTextShared(
    node: TermNode, buffer: CellBuffer, box: LayoutBox,
    styles: Map<number, ResolvedStyle>, layout: Map<number, LayoutBox>,
): void {
    const visuals = resolveInheritedVisuals(node, styles)
    paintTextContent(node, buffer, box, visuals, styles, layout)
}

function clearArea(buffer: CellBuffer, box: LayoutBox): void {
    for (let row = box.y; row < box.y + box.height; row++) {
        for (let col = box.x; col < box.x + box.width; col++) {
            buffer.setCell(col, row, { char: ' ', fg: 'default', bg: 'default', bold: false, italic: false, underline: false, strikethrough: false, dim: false })
        }
    }
}

function resolveInheritedVisuals(node: TermNode, styles: Map<number, ResolvedStyle>): {
    fg: string; bg: string; bold: boolean; italic: boolean;
    underline: boolean; strikethrough: boolean; dim: boolean; hyperlink?: string
} {
    const result: { fg: string; bg: string; bold: boolean; italic: boolean;
        underline: boolean; strikethrough: boolean; dim: boolean; hyperlink?: string } =
        { fg: 'default', bg: 'default', bold: false, italic: false, underline: false, strikethrough: false, dim: false }

    let current: TermNode | null = node.parent
    while (current) {
        const style = styles.get(current.id)
        if (style) {
            if (result.fg === 'default' && style.fg !== 'default') result.fg = style.fg
            if (result.bg === 'default' && style.bg !== 'default') result.bg = style.bg
            if (!result.bold && style.bold) result.bold = true
            if (!result.italic && style.italic) result.italic = true
            if (!result.underline && style.underline) result.underline = true
            if (!result.strikethrough && style.strikethrough) result.strikethrough = true
            if (!result.dim && style.dim) result.dim = true
        }
        if (!result.hyperlink && current.tag === 'a') {
            result.hyperlink = current.attributes.get('href')
        }
        current = current.parent
    }

    return result
}
