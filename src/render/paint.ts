import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'
import { renderBorder } from './border.js'

interface InheritedVisuals {
    fg: string
    bg: string
    bold: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
    dim: boolean
}

interface ClipRect {
    x: number
    y: number
    width: number
    height: number
}

const DEFAULT_VISUALS: InheritedVisuals = {
    fg: 'default', bg: 'default',
    bold: false, italic: false, underline: false, strikethrough: false, dim: false,
}

export function paint(
    root: TermNode,
    buffer: CellBuffer,
    styles?: Map<number, ResolvedStyle>,
    layout?: Map<number, LayoutBox>,
): void {
    paintNode(root, buffer, styles, layout, DEFAULT_VISUALS, null)
}

function paintNode(
    node: TermNode,
    buffer: CellBuffer,
    styles?: Map<number, ResolvedStyle>,
    layout?: Map<number, LayoutBox>,
    inherited: InheritedVisuals = DEFAULT_VISUALS,
    clip: ClipRect | null = null,
): void {
    if (node.nodeType === 'comment') return

    const visuals = resolveVisuals(node, styles, inherited)
    const box = layout?.get(node.id)

    if (node.nodeType === 'text') {
        paintText(node, buffer, box, visuals, clip)
        return
    }

    if (node.nodeType === 'element' && box) {
        fillBackground(buffer, box, visuals, clip)
        const ownStyle = styles?.get(node.id)
        if (ownStyle && ownStyle.borderStyle !== 'none') {
            renderBorder(buffer, box, ownStyle)
        }
    }

    // Determine clip rect for children
    let childClip = clip
    if (node.nodeType === 'element' && box) {
        const ownStyle = styles?.get(node.id)
        if (ownStyle && ownStyle.overflow !== 'visible') {
            childClip = intersectClip(clip, box)
        }
    }

    for (const child of node.children) {
        paintNode(child, buffer, styles, layout, visuals, childClip)
    }
}

function paintText(
    node: TermNode, buffer: CellBuffer, box: LayoutBox | undefined,
    visuals: InheritedVisuals, clip: ClipRect | null,
): void {
    const text = node.text ?? ''
    if (!text) return
    const x = box?.x ?? 0
    const y = box?.y ?? 0

    for (let i = 0; i < text.length; i++) {
        const cx = x + i
        const cy = y
        if (clip && !inClip(cx, cy, clip)) continue
        buffer.setCell(cx, cy, {
            char: text[i],
            fg: visuals.fg, bg: visuals.bg,
            bold: visuals.bold, italic: visuals.italic,
            underline: visuals.underline, strikethrough: visuals.strikethrough,
            dim: visuals.dim,
        })
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

    return {
        fg: own.fg !== 'default' ? own.fg : inherited.fg,
        bg: own.bg !== 'default' ? own.bg : inherited.bg,
        bold: own.bold || inherited.bold,
        italic: own.italic || inherited.italic,
        underline: own.underline || inherited.underline,
        strikethrough: own.strikethrough || inherited.strikethrough,
        dim: own.dim || inherited.dim,
    }
}
