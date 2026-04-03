import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'

/** Visual properties that inherit from parent to child. */
interface InheritedVisuals {
    fg: string
    bg: string
    bold: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
    dim: boolean
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
    paintNode(root, buffer, styles, layout, DEFAULT_VISUALS)
}

function paintNode(
    node: TermNode,
    buffer: CellBuffer,
    styles?: Map<number, ResolvedStyle>,
    layout?: Map<number, LayoutBox>,
    inherited: InheritedVisuals = DEFAULT_VISUALS,
): void {
    if (node.nodeType === 'comment') return

    const visuals = resolveVisuals(node, styles, inherited)
    const box = layout?.get(node.id)

    if (node.nodeType === 'text') {
        paintText(node, buffer, box, visuals)
        return
    }

    if (node.nodeType === 'element' && box) {
        fillBackground(buffer, box, visuals)
    }

    for (const child of node.children) {
        paintNode(child, buffer, styles, layout, visuals)
    }
}

function paintText(node: TermNode, buffer: CellBuffer, box: LayoutBox | undefined, visuals: InheritedVisuals): void {
    const text = node.text ?? ''
    if (!text) return
    buffer.writeText(box?.x ?? 0, box?.y ?? 0, text, visuals)
}

function fillBackground(buffer: CellBuffer, box: LayoutBox, visuals: InheritedVisuals): void {
    if (visuals.bg === 'default') return
    for (let row = box.y; row < box.y + box.height; row++) {
        for (let col = box.x; col < box.x + box.width; col++) {
            buffer.setCell(col, row, { bg: visuals.bg })
        }
    }
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
