/**
 * Shared text painting logic used by both full and incremental paint.
 * Single implementation prevents divergence.
 */
import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'
import { wrapText, truncateText } from '../layout/text.js'

interface TextVisuals {
    fg: string
    bg: string
    bold: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
    dim: boolean
    hyperlink?: string
}

/**
 * Paint a text node's content into the buffer, respecting inherited
 * text-align, white-space, text-overflow from ancestors.
 */
export function paintTextContent(
    node: TermNode,
    buffer: CellBuffer,
    box: LayoutBox,
    visuals: TextVisuals,
    styles: Map<number, ResolvedStyle>,
    layout: Map<number, LayoutBox>,
    clip?: { x: number; y: number; width: number; height: number } | null,
): void {
    const text = node.text ?? ''
    if (!text) return
    if (box.width === 0 && box.height === 0) return

    // Find text properties from the ancestor that sets them
    const alignResult = findAncestorWithBox(node, styles, layout, s => s.textAlign !== 'left' ? s.textAlign : undefined)
    const align = alignResult?.value ?? 'left'
    const whiteSpace = findAncestorProp(node, styles, s => s.whiteSpace !== 'normal' ? s.whiteSpace : undefined) ?? 'normal'
    const textOverflow = findAncestorProp(node, styles, s => s.textOverflow !== 'clip' ? s.textOverflow : undefined) ?? 'clip'

    const noWrap = whiteSpace === 'nowrap'
    const ellipsis = textOverflow === 'ellipsis'

    // For truncation, use the alignment container's inner width
    const alignBox = alignResult?.box
    const parentBox = node.parent ? layout.get(node.parent.id) : undefined
    const truncWidth = alignBox ? innerWidth(alignBox, node, styles, layout) : (parentBox?.width ?? box.width)

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
    if (align !== 'left' && alignBox) {
        const inW = innerWidth(alignBox, node, styles, layout)
        const inX = innerX(alignBox, node, styles, layout)
        const textWidth = lines[0]?.length ?? 0
        if (align === 'center') {
            startX = inX + Math.floor((inW - textWidth) / 2)
        } else if (align === 'right') {
            startX = inX + inW - textWidth
        }
    }

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx]
        const y = box.y + lineIdx
        for (let i = 0; i < line.length; i++) {
            const cx = startX + i
            if (clip && (cx < clip.x || cx >= clip.x + clip.width || y < clip.y || y >= clip.y + clip.height)) continue
            buffer.setCell(cx, y, {
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

/** Find an ancestor property value and the ancestor's layout box. */
function findAncestorWithBox<T>(
    node: TermNode,
    styles: Map<number, ResolvedStyle>,
    layout: Map<number, LayoutBox>,
    getter: (s: ResolvedStyle) => T | undefined,
): { value: T; box: LayoutBox } | undefined {
    let current: TermNode | null = node.parent
    while (current) {
        const s = styles.get(current.id)
        if (s) {
            const val = getter(s)
            if (val !== undefined) {
                const box = layout.get(current.id)
                if (box) return { value: val, box }
            }
        }
        current = current.parent
    }
    return undefined
}

/** Find an ancestor property value (without needing the box). */
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

/** Get inner X position (accounting for border) of the alignment container. */
function innerX(alignBox: LayoutBox, node: TermNode, styles: Map<number, ResolvedStyle>, layout: Map<number, LayoutBox>): number {
    const inset = findBorderInset(alignBox, node, styles, layout)
    return alignBox.x + inset
}

/** Get inner width (accounting for border) of the alignment container. */
function innerWidth(alignBox: LayoutBox, node: TermNode, styles: Map<number, ResolvedStyle>, layout: Map<number, LayoutBox>): number {
    const inset = findBorderInset(alignBox, node, styles, layout)
    return alignBox.width - inset * 2
}

/** Find the border inset of the ancestor that owns alignBox. */
function findBorderInset(alignBox: LayoutBox, node: TermNode, styles: Map<number, ResolvedStyle>, layout: Map<number, LayoutBox>): number {
    let current: TermNode | null = node.parent
    while (current) {
        if (layout.get(current.id) === alignBox) {
            const s = styles.get(current.id)
            return (s?.borderStyle && s.borderStyle !== 'none') ? 1 : 0
        }
        current = current.parent
    }
    return 0
}
