import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'
import { renderBorder } from './border.js'
import { wrapText, truncateText } from '../layout/text.js'

interface InheritedVisuals {
    fg: string
    bg: string
    bold: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
    dim: boolean
    hyperlink?: string
}

interface ClipRect {
    x: number
    y: number
    width: number
    height: number
}

interface ScrollOffset {
    x: number
    y: number
}

const DEFAULT_VISUALS: InheritedVisuals = {
    fg: 'default', bg: 'default',
    bold: false, italic: false, underline: false, strikethrough: false, dim: false,
}

const NO_SCROLL: ScrollOffset = { x: 0, y: 0 }

export function paint(
    root: TermNode,
    buffer: CellBuffer,
    styles?: Map<number, ResolvedStyle>,
    layout?: Map<number, LayoutBox>,
): void {
    paintNode(root, buffer, styles, layout, DEFAULT_VISUALS, null, NO_SCROLL)
}

function paintNode(
    node: TermNode,
    buffer: CellBuffer,
    styles: Map<number, ResolvedStyle> | undefined,
    layout: Map<number, LayoutBox> | undefined,
    inherited: InheritedVisuals,
    clip: ClipRect | null,
    scroll: ScrollOffset,
): void {
    if (node.nodeType === 'comment') return

    const visuals = resolveVisuals(node, styles, inherited)
    const rawBox = layout?.get(node.id)
    const box = rawBox ? applyScroll(rawBox, scroll) : undefined

    // Check visibility — hidden elements take space but don't render
    const ownStyle = node.nodeType === 'element' ? styles?.get(node.id) : undefined
    const parentStyle = node.parent ? styles?.get(node.parent.id) : undefined
    const isHidden = ownStyle?.visibility === 'hidden' || parentStyle?.visibility === 'hidden'

    if (node.nodeType === 'text') {
        if (!isHidden) {
            const parentBox = node.parent ? layout?.get(node.parent.id) : undefined
            paintText(node, buffer, box, visuals, clip, parentStyle, parentBox, styles)
        }
        return
    }

    if (node.nodeType === 'element' && box && !isHidden) {
        fillBackground(buffer, box, visuals, clip)
        if (ownStyle && ownStyle.borderStyle !== 'none') {
            renderBorder(buffer, box, ownStyle)
        }
        if (node.tag === 'hr') {
            paintHorizontalRule(buffer, box, visuals, clip)
            return
        }
        if (node.tag === 'li') {
            paintListMarker(node, buffer, box, visuals, clip)
        }
    }

    // Determine clip and scroll for children
    let childClip = clip
    let childScroll = scroll
    if (node.nodeType === 'element' && box) {
        const ownStyle = styles?.get(node.id)
        if (ownStyle && ownStyle.overflow !== 'visible') {
            childClip = intersectClip(clip, box)
        }
        if (node.scrollTop !== 0 || node.scrollLeft !== 0) {
            childScroll = { x: scroll.x + node.scrollLeft, y: scroll.y + node.scrollTop }
        }
    }

    for (const child of node.children) {
        paintNode(child, buffer, styles, layout, visuals, childClip, childScroll)
    }
}

function applyScroll(box: LayoutBox, scroll: ScrollOffset): LayoutBox {
    if (scroll.x === 0 && scroll.y === 0) return box
    return { x: box.x - scroll.x, y: box.y - scroll.y, width: box.width, height: box.height }
}

function paintText(
    node: TermNode, buffer: CellBuffer, box: LayoutBox | undefined,
    visuals: InheritedVisuals, clip: ClipRect | null,
    parentStyle: ResolvedStyle | undefined, parentBox: LayoutBox | undefined,
    styles?: Map<number, ResolvedStyle>,
): void {
    const text = node.text ?? ''
    if (!text) return
    let x = box?.x ?? 0
    const y = box?.y ?? 0
    const width = box?.width ?? buffer.width

    // Apply text-align (inherits from ancestors)
    const align = findInherited(node, styles, s => s.textAlign !== 'left' ? s.textAlign : undefined) ?? 'left'
    if (align !== 'left' && parentBox) {
        const textWidth = text.length
        if (align === 'center') {
            x = parentBox.x + Math.floor((parentBox.width - textWidth) / 2)
        } else if (align === 'right') {
            x = parentBox.x + parentBox.width - textWidth
        }
    }

    const noWrap = findInherited(node, styles, s => s.whiteSpace !== 'normal' ? s.whiteSpace : undefined) === 'nowrap'
    const ellipsis = findInherited(node, styles, s => s.textOverflow !== 'clip' ? s.textOverflow : undefined) === 'ellipsis'

    // For truncation, use clip width (parent container) if available
    const truncWidth = clip ? (clip.x + clip.width - x) : width

    let lines: string[]
    if (noWrap && ellipsis) {
        lines = [truncateText(text, truncWidth)]
    } else if (noWrap) {
        lines = [text.substring(0, truncWidth)]
    } else {
        lines = wrapText(text, width > 0 ? width : buffer.width)
    }

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx]
        const cy = y + lineIdx
        for (let i = 0; i < line.length; i++) {
            const cx = x + i
            if (clip && !inClip(cx, cy, clip)) continue
            buffer.setCell(cx, cy, {
                char: line[i],
                fg: visuals.fg, bg: visuals.bg,
                bold: visuals.bold, italic: visuals.italic,
                underline: visuals.underline, strikethrough: visuals.strikethrough,
                dim: visuals.dim,
                hyperlink: visuals.hyperlink,
            })
        }
    }
}

function fillBackground(
    buffer: CellBuffer, box: LayoutBox, visuals: InheritedVisuals, clip: ClipRect | null,
): void {
    if (visuals.bg === 'default') return
    for (let row = box.y; row < box.y + box.height; row++) {
        for (let col = box.x; col < box.x + box.width; col++) {
            if (clip && !inClip(col, row, clip)) continue
            buffer.setCell(col, row, { bg: visuals.bg })
        }
    }
}

function paintListMarker(
    node: TermNode, buffer: CellBuffer, box: LayoutBox,
    visuals: InheritedVisuals, clip: ClipRect | null,
): void {
    const parent = node.parent
    if (!parent) return

    const isOrdered = parent.tag === 'ol'
    let marker: string

    if (isOrdered) {
        const index = parent.children.filter(c => c.tag === 'li').indexOf(node)
        marker = `${index + 1}. `
    } else {
        marker = '• '
    }

    for (let i = 0; i < marker.length; i++) {
        const cx = box.x + i
        if (clip && !inClip(cx, box.y, clip)) continue
        buffer.setCell(cx, box.y, { char: marker[i], fg: visuals.fg, dim: visuals.dim })
    }
}

function paintHorizontalRule(
    buffer: CellBuffer, box: LayoutBox, visuals: InheritedVisuals, clip: ClipRect | null,
): void {
    for (let col = box.x; col < box.x + box.width; col++) {
        if (clip && !inClip(col, box.y, clip)) continue
        buffer.setCell(col, box.y, { char: '─', fg: visuals.fg, dim: true })
    }
}

function findInherited<T>(
    node: TermNode,
    styles: Map<number, ResolvedStyle> | undefined,
    getter: (s: ResolvedStyle) => T,
): T | undefined {
    let current: TermNode | null = node.parent
    while (current) {
        const s = styles?.get(current.id)
        if (s) {
            const val = getter(s)
            if (val !== undefined) return val
        }
        current = current.parent
    }
    return undefined
}

function inClip(col: number, row: number, clip: ClipRect): boolean {
    return col >= clip.x && col < clip.x + clip.width
        && row >= clip.y && row < clip.y + clip.height
}

function intersectClip(existing: ClipRect | null, box: LayoutBox): ClipRect {
    if (!existing) return { x: box.x, y: box.y, width: box.width, height: box.height }
    const x = Math.max(existing.x, box.x)
    const y = Math.max(existing.y, box.y)
    const right = Math.min(existing.x + existing.width, box.x + box.width)
    const bottom = Math.min(existing.y + existing.height, box.y + box.height)
    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) }
}

function resolveVisuals(
    node: TermNode,
    styles: Map<number, ResolvedStyle> | undefined,
    inherited: InheritedVisuals,
): InheritedVisuals {
    if (node.nodeType !== 'element') return inherited
    const own = styles?.get(node.id)
    if (!own) return inherited

    const hyperlink = node.tag === 'a' ? node.attributes.get('href') : inherited.hyperlink

    return {
        fg: own.fg !== 'default' ? own.fg : inherited.fg,
        bg: own.bg !== 'default' ? own.bg : inherited.bg,
        bold: own.bold || inherited.bold,
        italic: own.italic || inherited.italic,
        underline: own.underline || inherited.underline,
        strikethrough: own.strikethrough || inherited.strikethrough,
        dim: own.dim || inherited.dim,
        hyperlink,
    }
}
