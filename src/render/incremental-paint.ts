import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'
import { wrapText, truncateText } from '../layout/text.js'

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
            paintTextNode(node, buffer, box, styles, layout)
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
    layout: Map<number, LayoutBox>,
): void {
    const text = node.text ?? ''
    if (!text) return

    const visuals = resolveInheritedVisuals(node, styles)

    // Resolve text rendering properties from ancestors
    const textAlign = findAncestorProp(node, styles, s => s.textAlign !== 'left' ? s.textAlign : undefined) ?? 'left'
    const whiteSpace = findAncestorProp(node, styles, s => s.whiteSpace !== 'normal' ? s.whiteSpace : undefined) ?? 'normal'
    const textOverflow = findAncestorProp(node, styles, s => s.textOverflow !== 'clip' ? s.textOverflow : undefined) ?? 'clip'

    const noWrap = whiteSpace === 'nowrap'
    const ellipsis = textOverflow === 'ellipsis'

    // Get parent box for alignment and truncation width
    const parentBox = node.parent ? layout.get(node.parent.id) : undefined
    const truncWidth = parentBox ? parentBox.width : box.width

    // Determine text lines
    let lines: string[]
    if (noWrap && ellipsis) {
        lines = [truncateText(text, truncWidth)]
    } else if (noWrap) {
        lines = [text.substring(0, truncWidth)]
    } else {
        lines = wrapText(text, box.width > 0 ? box.width : buffer.width)
    }

    // Compute starting x with text-align
    let startX = box.x
    if (textAlign !== 'left' && parentBox) {
        const textWidth = lines[0]?.length ?? 0
        if (textAlign === 'center') {
            startX = parentBox.x + Math.floor((parentBox.width - textWidth) / 2)
        } else if (textAlign === 'right') {
            startX = parentBox.x + parentBox.width - textWidth
        }
    }

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx]
        const y = box.y + lineIdx
        for (let i = 0; i < line.length; i++) {
            buffer.setCell(startX + i, y, {
                char: line[i],
                fg: visuals.fg,
                bg: visuals.bg,
                bold: visuals.bold,
                italic: visuals.italic,
                underline: visuals.underline,
                strikethrough: visuals.strikethrough,
                dim: visuals.dim,
                hyperlink: visuals.hyperlink,
            })
        }
    }
}

function findAncestorProp<T>(
    node: TermNode,
    styles: Map<number, ResolvedStyle>,
    getter: (s: ResolvedStyle) => T | undefined,
): T | undefined {
    let current: TermNode | null = node.parent
    while (current) {
        const s = styles.get(current.id)
        if (s) {
            const val = getter(s)
            if (val !== undefined) return val
        }
        current = current.parent
    }
    return undefined
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
