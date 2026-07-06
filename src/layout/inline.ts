/**
 * Inline formatting context: a run of consecutive inline-level children
 * of a block container laid out as one unit. Text runs are gathered
 * depth-first through display:inline elements (inline-blocks join as
 * atoms), whitespace collapses, lines break across run boundaries, and
 * each text node's LayoutBox receives box-relative fragments plus a
 * bounding rect. Inline elements get the union rect of their
 * descendants' boxes.
 */
import { TermNode, childrenWithPseudos } from '../renderer/node.js'
import { ResolvedStyle } from '../css/compute.js'
import type { LayoutBox, TextFragment } from './engine.js'
import { breakInline, textItem, InlineItem, InlineAlign, BrokenFragment } from './inline-break.js'

type Styles = Map<number, ResolvedStyle>

/** Lays out a child subtree at a position; the engine's layoutNode. */
export type LayoutChild = (
    node: TermNode, x: number, y: number, availW: number, availH: number,
) => { width: number; height: number }

/** True for a child that participates in inline flow: text runs with
 * normal white-space, inline elements whose content is itself
 * inline-level, and inline-block atoms. */
export function isInlineLevel(node: TermNode, styles: Styles): boolean {
    if (node.nodeType === 'text') {
        if (node.parent?.tag === 'svt-ansi') return false
        return effectiveTextProp(node, styles, s => s.whiteSpace !== 'normal' ? s.whiteSpace : undefined) === undefined
    }
    if (node.nodeType !== 'element') return false
    const display = styles.get(node.id)?.display
    if (display === 'inline-block' || display === 'inline-table') return true
    if (display !== 'inline') return false
    return childrenWithPseudos(node).every(c => absorbsIntoInlineRun(c, styles))
}

/** Inline-level children extend an inline run; comments, display:none
 * and out-of-flow children don't break one. */
export function absorbsIntoInlineRun(node: TermNode, styles: Styles): boolean {
    if (node.nodeType === 'comment') return true
    if (node.nodeType === 'element') {
        const s = styles.get(node.id)
        if (s?.display === 'none') return true
        if (s?.position === 'absolute' || s?.position === 'fixed') return true
    }
    return isInlineLevel(node, styles)
}

/** Lays out one inline run at (x, y), writing fragment boxes for text
 * nodes, union boxes for inline elements, and re-positioning atoms.
 * Returns the run's natural size for the block-flow cursor. */
export function layoutInlineRun(
    children: TermNode[], styles: Styles, boxes: Map<number, LayoutBox>,
    x: number, y: number, availW: number, availH: number,
    layoutChild: LayoutChild,
): { width: number; height: number } {
    const gathered: GatheredItem[] = []
    gatherItems(children, styles, availW, availH, layoutChild, gathered)
    const align = resolveRunAlign(children[0], styles)
    const broken = breakInline(gathered.map(g => g.item), availW, align)
    const builder = new BoxBuilder(styles, boxes, gathered, broken.perItem, x, y, availW, availH, layoutChild)
    builder.buildBoxes(children)
    return { width: broken.width, height: broken.height }
}

interface GatheredItem { node: TermNode; item: InlineItem }

/** Appends the IFC participants under children depth-first, recursing
 * through inline elements. Order matches BoxBuilder.buildBoxes. */
function gatherItems(
    children: TermNode[], styles: Styles, availW: number, availH: number,
    layoutChild: LayoutChild, out: GatheredItem[],
): void {
    for (const child of children) {
        if (skipsInlineFlow(child, styles)) continue
        if (child.nodeType === 'text') {
            const text = transformText(child, styles)
            const breakAll = effectiveTextProp(child, styles, s => s.wordBreak !== 'normal' ? s.wordBreak : undefined) === 'break-all'
            out.push({ node: child, item: textItem(text, breakAll) })
            continue
        }
        const display = styles.get(child.id)?.display
        if (display === 'inline-block' || display === 'inline-table') {
            // Measure shrink-to-fit; re-positioned after line breaking.
            const size = layoutChild(child, 0, 0, availW, availH)
            out.push({ node: child, item: { kind: 'atom', width: size.width, height: size.height } })
            continue
        }
        gatherItems(childrenWithPseudos(child), styles, availW, availH, layoutChild, out)
    }
}

/** Children that generate no inline item: comments, display:none, and
 * out-of-flow elements (laid out by the block-flow pre-pass). */
function skipsInlineFlow(node: TermNode, styles: Styles): boolean {
    if (node.nodeType === 'comment') return true
    if (node.nodeType !== 'element') return false
    const s = styles.get(node.id)
    return s?.display === 'none' || s?.position === 'absolute' || s?.position === 'fixed'
}

/** Converts the broken run back into layout boxes mirroring the node
 * structure: fragments for text, union rects for inline elements. */
class BoxBuilder {
    private itemIdx = 0

    constructor(
        private readonly styles: Styles,
        private readonly boxes: Map<number, LayoutBox>,
        private readonly gathered: GatheredItem[],
        private readonly perItem: BrokenFragment[][],
        private readonly x: number,
        private readonly y: number,
        private readonly availW: number,
        private readonly availH: number,
        private readonly layoutChild: LayoutChild,
    ) {}

    buildBoxes(children: TermNode[]): void {
        for (const child of children) {
            if (skipsInlineFlow(child, this.styles)) continue
            if (child.nodeType === 'text') {
                this.buildTextBox(child, this.perItem[this.itemIdx++])
                continue
            }
            const display = this.styles.get(child.id)?.display
            if (display === 'inline-block' || display === 'inline-table') {
                this.placeAtom(child, this.perItem[this.itemIdx++])
                continue
            }
            this.buildUnionBox(child)
        }
    }

    /** A text node's box bounds its fragments; the fragments themselves
     * are stored box-relative so they move with the box. */
    private buildTextBox(node: TermNode, frags: BrokenFragment[]): void {
        if (frags.length === 0) {
            this.boxes.set(node.id, { x: this.x, y: this.y, width: 0, height: 0 })
            return
        }
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0
        for (const f of frags) {
            minX = Math.min(minX, f.x)
            minY = Math.min(minY, f.y)
            maxX = Math.max(maxX, f.x + f.width)
            maxY = Math.max(maxY, f.y + 1)
        }
        const fragments: TextFragment[] = frags.map(f => ({
            x: f.x - minX, y: f.y - minY, width: f.width, text: f.text,
        }))
        this.boxes.set(node.id, {
            x: this.x + minX, y: this.y + minY,
            width: maxX - minX, height: maxY - minY,
            fragments,
        })
    }

    /** Re-lays out an atom at its line slot (top-aligned on the line). */
    private placeAtom(node: TermNode, frags: BrokenFragment[]): void {
        if (frags.length === 0) return
        this.layoutChild(node, this.x + frags[0].x, this.y + frags[0].y, this.availW, this.availH)
    }

    /** An inline element takes the union rect of its descendants' boxes
     * and paints no box of its own (style reaches text via the visuals
     * cascade at paint time). */
    private buildUnionBox(node: TermNode): void {
        this.buildBoxes(childrenWithPseudos(node))
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0
        let found = false
        for (const child of childrenWithPseudos(node)) {
            const box = this.boxes.get(child.id)
            if (!box || (box.width === 0 && box.height === 0)) continue
            minX = Math.min(minX, box.x)
            minY = Math.min(minY, box.y)
            maxX = Math.max(maxX, box.x + box.width)
            maxY = Math.max(maxY, box.y + box.height)
            found = true
        }
        this.boxes.set(node.id, found
            ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY, union: true }
            : { x: this.x, y: this.y, width: 0, height: 0, union: true })
    }
}

/** The run's text-align: nearest ancestor with a non-left value,
 * starting at the run's container (matches paint's resolution). */
function resolveRunAlign(first: TermNode | undefined, styles: Styles): InlineAlign {
    let current = first?.parent ?? null
    while (current) {
        const align = styles.get(current.id)?.textAlign
        if (align && align !== 'left') return align
        current = current.parent
    }
    return 'left'
}

/** text-transform applies before line breaking so fragment widths are
 * final (paint paints fragment text verbatim). */
function transformText(node: TermNode, styles: Styles): string {
    const text = node.text ?? ''
    const transform = effectiveTextProp(node, styles, s => s.textTransform !== 'none' ? s.textTransform : undefined)
    if (transform === 'uppercase') return text.toUpperCase()
    if (transform === 'lowercase') return text.toLowerCase()
    if (transform === 'capitalize') return text.replace(/\b\w/g, c => c.toUpperCase())
    return text
}

/** Nearest ancestor value of an inherited-at-paint text property. */
function effectiveTextProp<T>(
    node: TermNode, styles: Styles, getter: (s: ResolvedStyle) => T | undefined,
): T | undefined {
    let current = node.parent
    while (current) {
        const s = styles.get(current.id)
        if (s) {
            const value = getter(s)
            if (value !== undefined) return value
        }
        current = current.parent
    }
    return undefined
}
