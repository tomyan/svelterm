/**
 * Shared text painting logic used by both full and incremental paint.
 * Single implementation prevents divergence.
 */
import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'
import { wrapText, truncateText, truncateMiddle } from '../layout/text.js'
import { parseAnsiText } from './ansi-text.js'
import { blendColor } from '../css/color.js'

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
    let text = node.text ?? ''
    if (!text) return
    if (box.width === 0 && box.height === 0) return

    // <svt-ansi> content is pre-styled — its own SGR codes win
    if (node.parent?.tag === 'svt-ansi') {
        paintAnsiContent(text, buffer, box, clip)
        return
    }

    // Find text properties from the ancestor that sets them
    const alignResult = findAncestorWithBox(node, styles, layout, s => s.textAlign !== 'left' ? s.textAlign : undefined)
    const align = alignResult?.value ?? 'left'
    const whiteSpace = findAncestorProp(node, styles, s => s.whiteSpace !== 'normal' ? s.whiteSpace : undefined) ?? 'normal'
    const textOverflow = findAncestorProp(node, styles, s => s.textOverflow !== 'clip' ? s.textOverflow : undefined) ?? 'clip'
    const textTransform = findAncestorProp(node, styles, s => s.textTransform !== 'none' ? s.textTransform : undefined)
    if (textTransform === 'uppercase') text = text.toUpperCase()
    else if (textTransform === 'lowercase') text = text.toLowerCase()
    else if (textTransform === 'capitalize') text = text.replace(/\b\w/g, c => c.toUpperCase())

    const noWrap = whiteSpace === 'nowrap'
    const wordBreak = findAncestorProp(node, styles, s => s.wordBreak !== 'normal' ? s.wordBreak : undefined) ?? 'normal'

    // For truncation, use the alignment container's inner width
    const alignBox = alignResult?.box
    const parentBox = node.parent ? layout.get(node.parent.id) : undefined
    const truncWidth = alignBox ? innerWidth(alignBox, node, styles, layout) : (parentBox?.width ?? box.width)

    // Determine text lines
    let lines: string[]
    if (noWrap && textOverflow === 'ellipsis') {
        lines = [truncateText(text, truncWidth)]
    } else if (noWrap && textOverflow === 'ellipsis-middle') {
        lines = [truncateMiddle(text, truncWidth)]
    } else if (noWrap) {
        lines = [text.substring(0, truncWidth)]
    } else {
        lines = wrapText(text, box.width > 0 ? box.width : buffer.width, wordBreak)
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

    const fgHasAlpha = visuals.fg.startsWith('#') && visuals.fg.length === 9
    const bgHasAlpha = visuals.bg.startsWith('#') && visuals.bg.length === 9
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx]
        const y = box.y + lineIdx
        for (let i = 0; i < line.length; i++) {
            const cx = startX + i
            if (clip && (cx < clip.x || cx >= clip.x + clip.width || y < clip.y || y >= clip.y + clip.height)) continue
            // An alpha bg was already composited by the ancestor's fill —
            // the cell beneath holds the blended value; don't blend twice.
            const under = buffer.getCell(cx, y)?.bg ?? 'default'
            const bg = bgHasAlpha ? under : visuals.bg
            buffer.setCell(cx, y, {
                char: line[i],
                fg: fgHasAlpha ? blendColor(bg !== 'default' ? bg : under, visuals.fg) : visuals.fg,
                bg,
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

/** Paint <svt-ansi> content: cells carry their own SGR styling. */
function paintAnsiContent(
    text: string, buffer: CellBuffer, box: LayoutBox,
    clip?: { x: number; y: number; width: number; height: number } | null,
): void {
    const lines = parseAnsiText(text)
    for (let row = 0; row < lines.length; row++) {
        const y = box.y + row
        if (clip && (y < clip.y || y >= clip.y + clip.height)) continue
        for (let col = 0; col < lines[row].length; col++) {
            const x = box.x + col
            if (clip && (x < clip.x || x >= clip.x + clip.width)) continue
            buffer.setCell(x, y, lines[row][col])
        }
    }
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
