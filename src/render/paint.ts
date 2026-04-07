import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'
import { renderBorder } from './border.js'
import { paintTextContent } from './paint-text.js'

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

    // Check display:none — element and all descendants are invisible and take no space
    const ownStyle = node.nodeType === 'element' ? styles?.get(node.id) : undefined
    const parentStyle = node.parent ? styles?.get(node.parent.id) : undefined
    if (ownStyle?.display === 'none' || parentStyle?.display === 'none') return

    // Check visibility — hidden elements take space but don't render
    const isHidden = ownStyle?.visibility === 'hidden' || parentStyle?.visibility === 'hidden'

    if (node.nodeType === 'text') {
        if (!isHidden) {
            const parentBox = node.parent ? layout?.get(node.parent.id) : undefined
            paintText(node, buffer, box, visuals, clip, parentStyle, parentBox, styles, layout)
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
        if (node.tag === 'input' && box) {
            paintInput(node, buffer, box, visuals, clip)
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
    layout?: Map<number, LayoutBox>,
): void {
    if (!box || !styles || !layout) return
    paintTextContent(node, buffer, box, visuals, styles, layout, clip)
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

function paintInput(
    node: TermNode, buffer: CellBuffer, box: LayoutBox,
    visuals: InheritedVisuals, clip: ClipRect | null,
): void {
    const value = node.attributes.get('value') ?? ''
    const isFocused = node.attributes.has('data-focused')
    const cursor = node.textBuffer?.cursor ?? value.length

    const style = node.cache.resolvedStyle
    const borderInset = (style?.borderStyle && style.borderStyle !== 'none') ? 1 : 0
    const padL = resolvePadVal(style?.paddingLeft) + borderInset
    const padR = resolvePadVal(style?.paddingRight) + borderInset

    const contentX = box.x + padL
    const contentY = box.y + borderInset
    const contentW = box.width - padL - padR

    if (contentW <= 0) return

    // Scroll offset: only adjust when cursor leaves visible range.
    // Cursor at end of text (position == value.length) can sit 1 cell
    // past the last character, using the right padding space.
    let scrollOffset = node.scrollLeft ?? 0

    // Cursor scrolled off the left → snap left edge to cursor
    if (cursor < scrollOffset) {
        scrollOffset = cursor
    }
    // Cursor scrolled off the right → scroll just enough to show it
    if (cursor > scrollOffset + contentW) {
        scrollOffset = cursor - contentW
    }
    // If cursor is mid-text and at the rightmost visible cell,
    // we need to be able to see what's after it
    if (cursor < value.length && cursor === scrollOffset + contentW) {
        scrollOffset = cursor - contentW + 1
    }
    scrollOffset = Math.max(0, scrollOffset)
    node.scrollLeft = scrollOffset

    // Determine what's visible and where overflow indicators go
    const hasOverflowLeft = scrollOffset > 0
    const visibleEnd = Math.min(scrollOffset + contentW, value.length)
    const hasOverflowRight = visibleEnd < value.length

    // Paint text — overflow indicators replace the first/last visible character
    for (let i = 0; i < contentW; i++) {
        const charIdx = scrollOffset + i
        if (charIdx >= value.length) break
        const cx = contentX + i
        if (clip && !inClip(cx, contentY, clip)) continue
        buffer.setCell(cx, contentY, { char: value[charIdx], fg: visuals.fg })
    }

    // Overflow indicators (faint ellipsis on top of first/last char)
    if (hasOverflowLeft) {
        const cx = contentX
        if (!clip || inClip(cx, contentY, clip)) {
            buffer.setCell(cx, contentY, { char: '…', fg: visuals.fg, dim: true })
        }
    }
    if (hasOverflowRight) {
        const cx = contentX + contentW - 1
        if (!clip || inClip(cx, contentY, clip)) {
            buffer.setCell(cx, contentY, { char: '…', fg: visuals.fg, dim: true })
        }
    }

    // Cursor (inverted colors)
    if (isFocused) {
        const cursorScreenX = contentX + (cursor - scrollOffset)
        if (cursorScreenX >= contentX && cursorScreenX <= contentX + contentW) {
            const cursorChar = cursor < value.length ? value[cursor] : ' '
            if (!clip || inClip(cursorScreenX, contentY, clip)) {
                buffer.setCell(cursorScreenX, contentY, {
                    char: cursorChar,
                    fg: visuals.bg !== 'default' ? visuals.bg : 'black',
                    bg: visuals.fg !== 'default' ? visuals.fg : 'white',
                })
            }
        }
    }
}

function resolvePadVal(v: number | string | undefined): number {
    if (typeof v === 'number') return v
    return 0
}

function paintHorizontalRule(
    buffer: CellBuffer, box: LayoutBox, visuals: InheritedVisuals, clip: ClipRect | null,
): void {
    for (let col = box.x; col < box.x + box.width; col++) {
        if (clip && !inClip(col, box.y, clip)) continue
        buffer.setCell(col, box.y, { char: '─', fg: visuals.fg, dim: true })
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
