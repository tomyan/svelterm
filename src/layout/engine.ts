import { TermNode, SvtRegionNode } from '../renderer/node.js'
import { ResolvedStyle, type StyleMap } from '../css/compute.js'
import { NodeMap } from '../utils/node-map.js'

export type LayoutMap = NodeMap<LayoutBox>
import { computeMainStart, computeItemGap, computeCrossOffset } from './flex.js'
import { measureText } from './text.js'
import { resolveSize, constrain } from './size.js'
import { parseCellLength } from '../css/values.js'

/**
 * Check if two adjacent siblings both have borders on their shared edge.
 * Returns true if the gap between them should be reduced by 1 to account
 * for the visual spacing inherent in box-drawing border characters.
 */
function shouldAdjustBorderGap(
    prevStyle: ResolvedStyle | undefined,
    nextStyle: ResolvedStyle | undefined,
    direction: 'vertical' | 'horizontal',
): boolean {
    if (!prevStyle || !nextStyle) return false
    if (prevStyle.borderStyle === 'none' || nextStyle.borderStyle === 'none') return false
    if (direction === 'vertical') {
        return prevStyle.borderBottom && nextStyle.borderTop
    } else {
        return prevStyle.borderRight && nextStyle.borderLeft
    }
}

/**
 * Approximate auto min-size in the main flex axis (CSS Flexbox §4.5).
 * Returns the smallest size the item can be without losing essential content:
 * borders that occupy main-axis space + (1 cell if the item has children, else 0).
 * overflow:hidden items can collapse to 0.
 */
function autoMinMainSize(
    node: TermNode,
    style: ResolvedStyle | undefined,
    baseDir: 'row' | 'column',
): number {
    if (!style) return 0
    if (style.overflow === 'hidden' || style.overflow === 'scroll') return 0
    if (node.children.length === 0) return 0
    const hasBorder = style.borderStyle && style.borderStyle !== 'none'
    const borderMain = hasBorder
        ? (baseDir === 'row'
            ? (style.borderLeft ? 1 : 0) + (style.borderRight ? 1 : 0)
            : (style.borderTop ? 1 : 0) + (style.borderBottom ? 1 : 0))
        : 0
    return borderMain + 1
}

/** Table-internal display values that need an anonymous table wrapper when
 * they appear in normal block flow (§17.2.1). */
function isTableInternal(node: TermNode, styles: Map<number, ResolvedStyle>): boolean {
    if (node.nodeType !== 'element') return false
    const display = styles.get(node.id)?.display
    return display === 'table-row' || display === 'table-cell'
        || display === 'table-row-group' || display === 'table-header-group'
        || display === 'table-footer-group'
}

/** Inter-element whitespace and comments don't break a run of consecutive
 * table-internal siblings. */
function absorbsIntoTableRun(node: TermNode, styles: Map<number, ResolvedStyle>): boolean {
    if (isTableInternal(node, styles)) return true
    if (node.nodeType === 'comment') return true
    return node.nodeType === 'text' && (node.text ?? '').trim() === ''
}

/** Collect the run of consecutive table-internal siblings starting at
 * `start`, returning the run and the index of its last absorbed child. */
function gatherTableRun(
    children: TermNode[], start: number, styles: Map<number, ResolvedStyle>,
): { run: TermNode[]; end: number } {
    const run: TermNode[] = []
    let i = start
    while (i < children.length && absorbsIntoTableRun(children[i], styles)) {
        if (isTableInternal(children[i], styles)) run.push(children[i])
        i++
    }
    return { run, end: i - 1 }
}

/** Flatten display:contents elements, promoting their children. */
function flattenContents(children: TermNode[], styles: Map<number, ResolvedStyle>): TermNode[] {
    const result: TermNode[] = []
    for (const child of children) {
        if (child.nodeType === 'element' && styles.get(child.id)?.display === 'contents') {
            result.push(...flattenContents(child.children, styles))
        } else {
            result.push(child)
        }
    }
    return result
}

export interface LayoutBox {
    x: number
    y: number
    width: number
    height: number
}

export function computeLayout(
    root: TermNode,
    styles: Map<number, ResolvedStyle>,
    availWidth: number,
    availHeight: number,
): Map<number, LayoutBox> {
    const boxes = new NodeMap<LayoutBox>()
    layoutNode(root, styles, boxes, 0, 0, availWidth, availHeight)
    return boxes
}

function layoutNode(
    node: TermNode,
    styles: Map<number, ResolvedStyle>,
    boxes: Map<number, LayoutBox>,
    x: number, y: number,
    availWidth: number, availHeight: number,
): { width: number; height: number } {
    if (node.nodeType === 'text') return layoutText(node, boxes, x, y, availWidth, styles)
    if (node.nodeType === 'comment') return { width: 0, height: 0 }
    if (node.nodeType === 'fragment') return layoutFragment(node, styles, boxes, x, y, availWidth, availHeight)
    return layoutElement(node, styles, boxes, x, y, availWidth, availHeight)
}

function layoutText(
    node: TermNode, boxes: Map<number, LayoutBox>,
    x: number, y: number, availWidth: number = Infinity,
    styles?: Map<number, ResolvedStyle>,
) {
    const text = node.text ?? ''
    const parentStyle = node.parent ? styles?.get(node.parent.id) : undefined
    const preserveWhitespace = parentStyle?.whiteSpace === 'pre'

    // Skip empty text and inter-element whitespace.
    // Preserve whitespace between inline siblings (matching browser behaviour),
    // but collapse between block-level siblings or inside flex/grid containers
    // (where children are blockified).
    if (text === '') {
        boxes.set(node.id, { x, y, width: 0, height: 0 })
        return { width: 0, height: 0 }
    }
    if (!preserveWhitespace && text.trim() === '' && node.parent?.children.some(c => c.nodeType === 'element')) {
        const parentDisplay = parentStyle?.display ?? 'block'
        const isFlexOrGrid = parentDisplay === 'flex' || parentDisplay === 'grid'
        const hasBlockSibling = node.parent.children.some(c => {
            if (c.nodeType !== 'element') return false
            const d = styles?.get(c.id)?.display ?? 'block'
            return d !== 'inline'
        })
        if (isFlexOrGrid || hasBlockSibling) {
            boxes.set(node.id, { x, y, width: 0, height: 0 })
            return { width: 0, height: 0 }
        }
    }

    // Check parent's whiteSpace
    const noWrap = parentStyle?.whiteSpace === 'nowrap'
    const wrapWidth = noWrap ? Infinity : (availWidth > 0 ? availWidth : Infinity)

    const measured = measureText(text, wrapWidth)
    boxes.set(node.id, { x, y, width: measured.width, height: measured.height })
    return measured
}

function layoutFragment(
    node: TermNode, styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, availWidth: number, availHeight: number,
) {
    return layoutBlockFlow(node.children, styles, boxes, x, y, availWidth, availHeight)
}

function layoutElement(
    node: TermNode, styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, availWidth: number, availHeight: number,
) {
    const style = styles.get(node.id)
    if (style?.display === 'none') return { width: 0, height: 0 }

    // display: contents — element is invisible to layout, children promoted
    if (style?.display === 'contents') {
        return layoutBlockFlow(node.children, styles, boxes, x, y, availWidth, availHeight)
    }

    // Absolute positioning: use top/left offsets relative to parent, don't consume space in flow
    if (style?.position === 'absolute' || style?.position === 'fixed') {
        const absX = x + (style.left ?? 0)
        const absY = y + (style.top ?? 0)
        return layoutAbsolute(node, styles, boxes, absX, absY, availWidth, availHeight, style)
    }

    let margin = {
        top: resolvePadding(style?.marginTop, availWidth),
        right: resolvePadding(style?.marginRight, availWidth),
        bottom: resolvePadding(style?.marginBottom, availWidth),
        left: resolvePadding(style?.marginLeft, availWidth),
    }
    const borderWidth = (style?.borderStyle && style.borderStyle !== 'none') ? 1 : 0
    const collapsesPadding = isOuterFacingBorder(style?.borderStyle)
    const collapsesMargin = isInnerFacingBorder(style?.borderStyle)
    const inset = {
        top: insetWithCollapse(style?.paddingTop, availWidth, style?.borderTop, borderWidth, collapsesPadding),
        right: insetWithCollapse(style?.paddingRight, availWidth, style?.borderRight, borderWidth, collapsesPadding),
        bottom: insetWithCollapse(style?.paddingBottom, availWidth, style?.borderBottom, borderWidth, collapsesPadding),
        left: insetWithCollapse(style?.paddingLeft, availWidth, style?.borderLeft, borderWidth, collapsesPadding),
    }
    if (collapsesMargin) {
        margin = {
            top: collapseMargin(margin.top, style?.borderTop, borderWidth),
            right: collapseMargin(margin.right, style?.borderRight, borderWidth),
            bottom: collapseMargin(margin.bottom, style?.borderBottom, borderWidth),
            left: collapseMargin(margin.left, style?.borderLeft, borderWidth),
        }
    }

    // Resolve auto margins for centering
    const nodeWidthForAutoMargin = resolveSize(style?.width, availWidth)
    if (margin.left === -1 && margin.right === -1 && nodeWidthForAutoMargin !== null) {
        const remaining = availWidth - nodeWidthForAutoMargin
        margin = { ...margin, left: Math.floor(remaining / 2), right: Math.ceil(remaining / 2) }
    } else {
        if (margin.left === -1) margin = { ...margin, left: 0 }
        if (margin.right === -1) margin = { ...margin, right: 0 }
    }

    const boxX = x + margin.left
    const boxY = y + margin.top
    // Walk past display:contents ancestors to find the actual layout parent
    let layoutParent = node.parent
    while (layoutParent && styles.get(layoutParent.id)?.display === 'contents') {
        layoutParent = layoutParent.parent
    }
    const parentDisplay = layoutParent ? styles.get(layoutParent.id)?.display : undefined
    const isFlexOrGridChild = parentDisplay === 'flex' || parentDisplay === 'grid'
    const isContentBox = style?.boxSizing === 'content-box'
    let explicitWidth = resolveSize(style?.width, availWidth - margin.left - margin.right)
    if (explicitWidth !== null && isContentBox) explicitWidth += inset.left + inset.right
    // Flex/grid children are sized by their parent algorithm, not clamped to available width
    const nodeWidth = explicitWidth !== null
        ? (isFlexOrGridChild ? explicitWidth : Math.min(explicitWidth, availWidth - margin.left - margin.right))
        : null
    let nodeHeight = resolveSize(style?.height, availHeight - margin.top - margin.bottom)
    if (nodeHeight !== null && isContentBox) nodeHeight += inset.top + inset.bottom

    // Apply max-width/max-height to available space so children (e.g. flex-wrap) respect constraints
    let effectiveW = nodeWidth ?? (availWidth - margin.left - margin.right)
    if (style?.maxWidth != null && effectiveW > style.maxWidth) effectiveW = style.maxWidth
    let effectiveH = nodeHeight ?? (availHeight - margin.top - margin.bottom)
    if (style?.maxHeight != null && effectiveH > style.maxHeight) effectiveH = style.maxHeight
    const innerW = effectiveW - inset.left - inset.right
    const innerH = effectiveH - inset.top - inset.bottom

    const display = style?.display ?? 'block'
    let content: { width: number; height: number }

    if (display === 'flex') {
        content = positionChildren(
            node.children, styles, boxes,
            boxX + inset.left, boxY + inset.top, innerW, innerH,
            style?.flexDirection ?? 'column', style?.gap ?? 0,
            style?.justifyContent ?? 'start', style?.alignItems ?? 'start',
            style?.flexWrap ?? 'nowrap',
        )
    } else if (display === 'table' || display === 'inline-table') {
        content = layoutTable(node, styles, boxes, boxX + inset.left, boxY + inset.top, innerW, innerH)
    } else if (display === 'grid' && style) {
        content = layoutGrid(node, styles, boxes, boxX + inset.left, boxY + inset.top, innerW, innerH, style)
    } else {
        // block or inline — use block flow (inline children flow horizontally within)
        content = layoutBlockFlow(node.children, styles, boxes, boxX + inset.left, boxY + inset.top, innerW, innerH)
    }

    // Block elements fill parent width; inline/inline-block shrink-wrap to content.
    // Flex/grid children are sized by the flex/grid algorithm, so they shrink-wrap.
    const isBlock = (display === 'block' || display === 'flex' || display === 'grid' || display === 'table')
        && !isFlexOrGridChild
    // Paint primitives (svt-region) have no meaningful content size — they
    // exist to fill an allocated cell area. Default to the parent's available
    // box on both axes when no explicit dimension was given, like an
    // intrinsically sized replaced element rather than a content-sized div.
    const isFillPrimitive = node instanceof SvtRegionNode
    const autoWidth = isFillPrimitive || isBlock
        ? (availWidth - margin.left - margin.right)
        : content.width + inset.left + inset.right
    // Input/textarea have intrinsic minimum height of 1 row for the value text
    const intrinsicHeight = (node.tag === 'input' || node.tag === 'textarea')
        ? Math.max(content.height, 1)
        : content.height
    const autoHeight = isFillPrimitive
        ? (availHeight - margin.top - margin.bottom)
        : intrinsicHeight + inset.top + inset.bottom
    const finalWidth = constrain(nodeWidth ?? autoWidth, style?.minWidth, style?.maxWidth)
    const finalHeight = constrain(nodeHeight ?? autoHeight, style?.minHeight, style?.maxHeight)

    boxes.set(node.id, { x: boxX, y: boxY, width: finalWidth, height: finalHeight })
    // Return outer size including margin
    return { width: finalWidth + margin.left + margin.right, height: finalHeight + margin.top + margin.bottom }
}

function layoutAbsolute(
    node: TermNode, styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, availWidth: number, availHeight: number, style: ResolvedStyle,
) {
    const borderWidth = (style.borderStyle && style.borderStyle !== 'none') ? 1 : 0
    const collapsesPadding = isOuterFacingBorder(style.borderStyle)
    const inset = {
        top: insetWithCollapse(style.paddingTop, availWidth, style.borderTop, borderWidth, collapsesPadding),
        right: insetWithCollapse(style.paddingRight, availWidth, style.borderRight, borderWidth, collapsesPadding),
        bottom: insetWithCollapse(style.paddingBottom, availWidth, style.borderBottom, borderWidth, collapsesPadding),
        left: insetWithCollapse(style.paddingLeft, availWidth, style.borderLeft, borderWidth, collapsesPadding),
    }
    const nodeWidth = resolveSize(style.width, availWidth)
    const nodeHeight = resolveSize(style.height, availHeight)

    const innerW = (nodeWidth ?? availWidth) - inset.left - inset.right
    const innerH = (nodeHeight ?? availHeight) - inset.top - inset.bottom

    const content = positionChildren(
        node.children, styles, boxes,
        x + inset.left, y + inset.top, innerW, innerH,
        style.flexDirection ?? 'column', style.gap ?? 0,
        style.justifyContent ?? 'start', style.alignItems ?? 'start',
    )

    const finalWidth = constrain(nodeWidth ?? (content.width + inset.left + inset.right), style.minWidth, style.maxWidth)
    const finalHeight = constrain(nodeHeight ?? (content.height + inset.top + inset.bottom), style.minHeight, style.maxHeight)

    boxes.set(node.id, { x, y, width: finalWidth, height: finalHeight })
    // Return zero size — absolute elements don't consume space in flow
    return { width: 0, height: 0 }
}

/** Resolve a padding/margin value that may be a number or a % string */
function resolvePadding(value: number | string | undefined, availWidth: number): number {
    if (value === undefined) return 0
    if (typeof value === 'number') return value
    return resolveSize(value, availWidth) ?? 0
}

/**
 * Block-character border styles whose stroke faces outward.
 * The unused (inner) portion of the border cell collapses with `padding`.
 */
function isOuterFacingBorder(borderStyle: string | undefined): boolean {
    return borderStyle === 'eighth-cell-outer' || borderStyle === 'half-cell-outer'
}

/**
 * Block-character border styles whose stroke faces inward.
 * The unused (outer) portion of the border cell collapses with `margin`.
 */
function isInnerFacingBorder(borderStyle: string | undefined): boolean {
    return borderStyle === 'eighth-cell-inner' || borderStyle === 'half-cell-inner'
}

/**
 * Compute total inset on one side, applying the padding/border collapse rule when applicable.
 * When the border absorbs padding, total inset = max(padding, borderWidth).
 * Otherwise total inset = padding + borderWidth.
 */
function insetWithCollapse(
    padding: number | string | undefined,
    availWidth: number,
    sideHasBorder: boolean | undefined,
    borderWidth: number,
    collapses: boolean,
): number {
    const p = resolvePadding(padding, availWidth)
    const sideBorder = sideHasBorder ? borderWidth : 0
    if (collapses && sideHasBorder) return Math.max(p, sideBorder)
    return p + sideBorder
}

/**
 * Apply the margin collapse rule for inner-facing borders on a single side.
 * When the border absorbs margin: effective margin = max(margin - 1, 0).
 * Caller must check the side actually has a border before calling.
 */
function collapseMargin(
    marginValue: number,
    sideHasBorder: boolean | undefined,
    borderWidth: number,
): number {
    if (!sideHasBorder || marginValue <= 0) return marginValue
    return Math.max(marginValue - borderWidth, 0)
}

function layoutBlockFlow(
    children: TermNode[], styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, availW: number, availH: number,
): { width: number; height: number } {
    // Layout absolute children first
    for (const child of children) {
        const s = styles.get(child.id)
        if (s?.position === 'absolute' || s?.position === 'fixed') {
            layoutNode(child, styles, boxes, x, y, availW, availH)
        }
    }

    let cursorX = x
    let cursorY = y
    let lineHeight = 0
    let maxWidth = 0
    let prevBlockMarginBottom = 0
    let prevBlockStyle: ResolvedStyle | undefined

    const flatChildren = flattenContents(children, styles)

    for (let i = 0; i < flatChildren.length; i++) {
        const child = flatChildren[i]
        if (child.nodeType === 'comment') continue
        const s = styles.get(child.id)
        if (s?.display === 'none') continue
        if (s?.position === 'absolute' || s?.position === 'fixed') continue

        // Stray table-internal content (a <tr>/<td>/row-group outside a
        // table) wraps in an anonymous table together with its consecutive
        // table-internal siblings (§17.2.1).
        if (isTableInternal(child, styles)) {
            const { run, end } = gatherTableRun(flatChildren, i, styles)
            i = end
            if (cursorX > x) {
                cursorY += lineHeight
                cursorX = x
                lineHeight = 0
            }
            const size = layoutTableChildren(run, undefined, styles, boxes, x, cursorY, availW, availH - (cursorY - y))
            cursorY += size.height
            maxWidth = Math.max(maxWidth, size.width)
            prevBlockMarginBottom = 0
            prevBlockStyle = undefined
            continue
        }

        const isInline = child.nodeType === 'text' || s?.display === 'inline'
            || s?.display === 'inline-block' || s?.display === 'inline-table'

        if (isInline) {
            // Flow horizontally
            const size = layoutNode(child, styles, boxes, cursorX, cursorY, availW - (cursorX - x), availH)
            cursorX += size.width
            lineHeight = Math.max(lineHeight, size.height)
            maxWidth = Math.max(maxWidth, cursorX - x)
            prevBlockMarginBottom = 0
        } else {
            // Block element — new line first if we have inline content
            if (cursorX > x) {
                cursorY += lineHeight
                cursorX = x
                lineHeight = 0
            }

            // Margin collapsing: adjacent vertical margins collapse to the larger
            const childMarginTop = resolvePadding(s?.marginTop, availW)
            if (prevBlockMarginBottom > 0 && childMarginTop > 0) {
                const collapsed = Math.max(prevBlockMarginBottom, childMarginTop)
                const overlap = prevBlockMarginBottom + childMarginTop - collapsed
                cursorY -= overlap
            }

            // Border collapse: adjacent bordered blocks overlap by 1
            if (shouldAdjustBorderGap(prevBlockStyle, s, 'vertical')) {
                cursorY -= 1
            }

            const size = layoutNode(child, styles, boxes, x, cursorY, availW, availH - (cursorY - y))
            cursorY += size.height
            maxWidth = Math.max(maxWidth, size.width)
            prevBlockMarginBottom = resolvePadding(s?.marginBottom, availW)
            prevBlockStyle = s
        }
    }

    // Account for trailing inline content
    if (cursorX > x) {
        cursorY += lineHeight
    }

    return { width: maxWidth, height: cursorY - y }
}

/** A table row; trNode is null for anonymous rows generated around stray cells (§17.2.1). */
interface TableRow { trNode: TermNode | null; cells: TermNode[] }

function rawColspan(cell: TermNode): number {
    const raw = cell.attributes.get('colspan')
    if (!raw) return 1
    const n = parseInt(raw)
    // colspan=0 means "span remaining columns"; resolved against the table's
    // numCols in buildTableGrid.
    if (n === 0) return 0
    return n > 0 ? n : 1
}

function cellRowspan(cell: TermNode): number {
    const raw = cell.attributes.get('rowspan')
    if (!raw) return 1
    const n = parseInt(raw)
    return n > 0 ? n : 1
}

interface TableGrid {
    occupied: boolean[][]
    numCols: number
    span: Map<number, number>
}

function buildTableGrid(rows: TableRow[]): TableGrid {
    // First pass: numCols treating colspan=0 as 1.
    let numCols = 0
    const provisional: boolean[][] = rows.map(() => [])
    for (let r = 0; r < rows.length; r++) {
        let col = 0
        for (const cell of rows[r].cells) {
            while (provisional[r][col]) col++
            const cs = rawColspan(cell)
            const span = cs === 0 ? 1 : cs
            const rspan = cellRowspan(cell)
            for (let dr = 1; dr < rspan && r + dr < rows.length; dr++) {
                for (let dc = 0; dc < span; dc++) provisional[r + dr][col + dc] = true
            }
            col += span
            if (col > numCols) numCols = col
        }
    }

    // Second pass: rebuild grid with colspan=0 expanded to fill remaining columns.
    const occupied: boolean[][] = rows.map(() => [])
    const span = new Map<number, number>()
    for (let r = 0; r < rows.length; r++) {
        let col = 0
        for (const cell of rows[r].cells) {
            while (occupied[r][col]) col++
            const cs = rawColspan(cell)
            const resolved = cs === 0 ? Math.max(1, numCols - col) : cs
            span.set(cell.id, resolved)
            const rspan = cellRowspan(cell)
            for (let dr = 1; dr < rspan && r + dr < rows.length; dr++) {
                for (let dc = 0; dc < resolved; dc++) occupied[r + dr][col + dc] = true
            }
            col += resolved
        }
    }
    return { occupied, numCols, span }
}

function cellColspan(grid: TableGrid, cell: TermNode): number {
    return grid.span.get(cell.id) ?? 1
}

/** True for content that acts as a table cell inside a row: real cells, plus
 * stray text / elements that get an anonymous cell box per §17.2.1. */
function isCellContent(node: TermNode, styles: Map<number, ResolvedStyle>): boolean {
    if (node.nodeType === 'text') return (node.text ?? '').trim() !== ''
    if (node.nodeType !== 'element') return false
    const display = styles.get(node.id)?.display
    return display !== 'none' && !isRowLevelDisplay(display)
}

function isRowLevelDisplay(display: string | undefined): boolean {
    return display === 'table-row'
        || display === 'table-row-group' || display === 'table-header-group'
        || display === 'table-footer-group'
        || display === 'table-caption' || display === 'table-column'
        || display === 'table-column-group'
}

function cellsOfRow(trNode: TermNode, styles: Map<number, ResolvedStyle>): TermNode[] {
    return trNode.children.filter(c => isCellContent(c, styles))
}

/**
 * Group the children of a table or row-group into rows. Explicit table-rows
 * keep their cells; a run of consecutive stray cell-content children forms
 * one anonymous row (§17.2.1). Simplification vs the spec: each stray child
 * is its own anonymous cell rather than coalescing consecutive inline
 * content into one.
 */
function groupIntoRows(children: TermNode[], styles: Map<number, ResolvedStyle>): TableRow[] {
    const rows: TableRow[] = []
    let anonymous: TermNode[] = []
    const flushAnonymous = () => {
        if (anonymous.length > 0) {
            rows.push({ trNode: null, cells: anonymous })
            anonymous = []
        }
    }
    for (const child of children) {
        if (child.nodeType === 'element' && styles.get(child.id)?.display === 'table-row') {
            flushAnonymous()
            rows.push({ trNode: child, cells: cellsOfRow(child, styles) })
        } else if (isCellContent(child, styles)) {
            anonymous.push(child)
        }
    }
    flushAnonymous()
    return rows
}

function collectTableRows(children: TermNode[], styles: Map<number, ResolvedStyle>): TableRow[] {
    // Per CSS 2.2 §17.5.2: header → bodies (in source order) → footer.
    // Bare <tr> (or stray cell content) children of <table> form an implicit
    // body, mirroring the browser HTML parser's auto-tbody insertion.
    const headerRows: TableRow[] = []
    const bodyRows: TableRow[] = []
    const footerRows: TableRow[] = []
    let strayRun: TermNode[] = []
    const flushStray = () => {
        if (strayRun.length > 0) {
            bodyRows.push(...groupIntoRows(strayRun, styles))
            strayRun = []
        }
    }
    for (const child of children) {
        const display = child.nodeType === 'element' ? styles.get(child.id)?.display : undefined
        if (display === 'table-header-group') {
            flushStray()
            headerRows.push(...groupIntoRows(child.children, styles))
        } else if (display === 'table-footer-group') {
            flushStray()
            footerRows.push(...groupIntoRows(child.children, styles))
        } else if (display === 'table-row-group') {
            flushStray()
            bodyRows.push(...groupIntoRows(child.children, styles))
        } else {
            // table-rows and stray cell content accumulate; captions/columns
            // are filtered out inside groupIntoRows.
            strayRun.push(child)
        }
    }
    flushStray()
    return [...headerRows, ...bodyRows, ...footerRows]
}

function findCaption(children: TermNode[], styles: Map<number, ResolvedStyle>): TermNode | undefined {
    return children.find(c => styles.get(c.id)?.display === 'table-caption')
}

function colSpanAttr(colNode: TermNode): number {
    const raw = colNode.attributes.get('span')
    if (!raw) return 1
    const n = parseInt(raw)
    return n > 0 ? n : 1
}

function explicitWidth(node: TermNode, styles: Map<number, ResolvedStyle>): number {
    const w = styles.get(node.id)?.width
    return typeof w === 'number' && w > 0 ? w : 0
}

function applyColHint(hints: number[], col: number, span: number, width: number): void {
    if (width <= 0) return
    for (let i = 0; i < span; i++) {
        hints[col + i] = Math.max(hints[col + i] ?? 0, width)
    }
}

function collectColHints(children: TermNode[], styles: Map<number, ResolvedStyle>): number[] {
    // Walks <col> and <colgroup> in document order; returns per-column width
    // hints (sparse). <col span> covers multiple columns; a <colgroup> with no
    // <col> children covers `span` columns itself.
    const hints: number[] = []
    let col = 0
    for (const child of children) {
        const display = styles.get(child.id)?.display
        if (display === 'table-column') {
            const span = colSpanAttr(child)
            applyColHint(hints, col, span, explicitWidth(child, styles))
            col += span
        } else if (display === 'table-column-group') {
            const colChildren = child.children.filter(c => styles.get(c.id)?.display === 'table-column')
            if (colChildren.length === 0) {
                const span = colSpanAttr(child)
                applyColHint(hints, col, span, explicitWidth(child, styles))
                col += span
            } else {
                for (const colNode of colChildren) {
                    const span = colSpanAttr(colNode)
                    applyColHint(hints, col, span, explicitWidth(colNode, styles))
                    col += span
                }
            }
        }
    }
    return hints
}

interface TableGaps { col: number; row: number }

/**
 * Horizontal/vertical gap between table tracks. The separate model uses
 * border-spacing; the collapsed model overlaps tracks by one cell where
 * adjacent border strokes would otherwise double up, so they coincide and
 * merge into shared grid lines. A track boundary only collapses when cells
 * are bordered on both of its sides (e.g. left+right for columns) — one-sided
 * borders such as row separators already draw a single line and need no overlap.
 */
function tableGaps(
    tableStyle: ResolvedStyle | undefined, rows: TableRow[],
    styles: Map<number, ResolvedStyle>,
): TableGaps {
    if (tableStyle?.borderCollapse === 'collapse') {
        return {
            col: allCellsBordered(rows, styles, 'borderLeft', 'borderRight') ? -1 : 0,
            row: allCellsBordered(rows, styles, 'borderTop', 'borderBottom') ? -1 : 0,
        }
    }
    return { col: tableStyle?.borderSpacingH ?? 0, row: tableStyle?.borderSpacingV ?? 0 }
}

type BorderSide = 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft'

function allCellsBordered(
    rows: TableRow[], styles: Map<number, ResolvedStyle>, ...sides: BorderSide[]
): boolean {
    return rows.every(row => row.cells.every(cell => {
        const style = styles.get(cell.id)
        return style !== undefined && style.borderStyle !== 'none'
            && sides.every(side => style[side])
    }))
}

function measureColumnWidths(
    rows: TableRow[], grid: TableGrid,
    styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    availW: number, availH: number,
    mode: 'auto' | 'fixed' = 'auto',
): number[] {
    const colWidths: number[] = new Array(grid.numCols).fill(0)
    // Only single-column cells contribute directly to column widths in this
    // pass; colspan>1 cells are positioned later using the resolved widths.
    // table-layout: fixed only consults the first row.
    const lastRow = mode === 'fixed' ? Math.min(1, rows.length) : rows.length
    for (let r = 0; r < lastRow; r++) {
        let col = 0
        for (const cell of rows[r].cells) {
            while (grid.occupied[r][col]) col++
            const span = cellColspan(grid, cell)
            if (span === 1) {
                const size = layoutNode(cell, styles, boxes, 0, 0, availW, availH)
                colWidths[col] = Math.max(colWidths[col], size.width)
            }
            col += span
        }
    }
    return colWidths
}

function placeCaption(
    caption: TermNode, styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, tableWidth: number, availH: number,
): number {
    const size = layoutNode(caption, styles, boxes, x, y, tableWidth, availH)
    const captionBox = boxes.get(caption.id)
    if (captionBox) captionBox.width = tableWidth
    return size.height
}

function spannedWidth(colWidths: number[], col: number, span: number, colGap: number): number {
    let w = 0
    for (let i = 0; i < span; i++) w += colWidths[col + i] ?? 0
    return w + colGap * Math.max(0, span - 1)
}

interface PlacedCell { cell: TermNode; rowIdx: number; rspan: number; contentHeight: number }

function shiftSubtreeY(node: TermNode, boxes: Map<number, LayoutBox>, dy: number): void {
    for (const child of node.children) {
        const box = boxes.get(child.id)
        if (box) box.y += dy
        shiftSubtreeY(child, boxes, dy)
    }
}

function applyVerticalAlign(
    cell: TermNode, totalHeight: number, contentHeight: number,
    styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
): void {
    const cellBox = boxes.get(cell.id)
    if (cellBox) cellBox.height = totalHeight
    const slack = totalHeight - contentHeight
    if (slack <= 0) return
    const va = styles.get(cell.id)?.verticalAlign ?? 'top'
    if (va === 'top') return
    const dy = va === 'middle' ? Math.floor(slack / 2) : slack
    shiftSubtreeY(cell, boxes, dy)
}

function placeRows(
    rows: TableRow[], grid: TableGrid,
    styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, startY: number, colWidths: number[], tableWidth: number, availH: number,
    gaps: TableGaps,
): number {
    const rowHeights: number[] = []
    const placed: PlacedCell[] = []

    // Pass 1: lay out each cell, accumulate per-row height from non-rowspan cells.
    let rowY = startY
    for (let r = 0; r < rows.length; r++) {
        const { trNode, cells } = rows[r]
        let col = 0
        let colX = x
        let rowHeight = 0
        for (const cell of cells) {
            while (grid.occupied[r][col]) {
                colX += colWidths[col] + gaps.col
                col++
            }
            const span = cellColspan(grid, cell)
            const rspan = cellRowspan(cell)
            const cellWidth = spannedWidth(colWidths, col, span, gaps.col)
            const size = layoutNode(cell, styles, boxes, colX, rowY, cellWidth, availH)
            const cellBox = boxes.get(cell.id)
            if (cellBox && cellBox.width < cellWidth) cellBox.width = cellWidth
            if (rspan === 1) rowHeight = Math.max(rowHeight, size.height)
            placed.push({ cell, rowIdx: r, rspan, contentHeight: size.height })
            colX += cellWidth + gaps.col
            col += span
        }
        const trMinHeight = trNode ? styles.get(trNode.id)?.height : undefined
        if (typeof trMinHeight === 'number' && trMinHeight > rowHeight) rowHeight = trMinHeight
        rowHeights.push(rowHeight)
        if (trNode) boxes.set(trNode.id, { x, y: rowY, width: tableWidth, height: rowHeight })
        rowY += rowHeight + gaps.row
    }

    // Pass 2: stretch each cell to its row's total height and apply vertical-align.
    for (const { cell, rowIdx, rspan, contentHeight } of placed) {
        let totalH = 0
        let spanRows = 0
        for (let r = 0; r < rspan && rowIdx + r < rows.length; r++) {
            totalH += rowHeights[rowIdx + r]
            spanRows++
        }
        totalH += gaps.row * Math.max(0, spanRows - 1)
        applyVerticalAlign(cell, totalH, contentHeight, styles, boxes)
    }

    return rowY - startY - (rows.length > 0 ? gaps.row : 0)
}

function layoutTable(
    node: TermNode, styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, availW: number, availH: number,
): { width: number; height: number } {
    return layoutTableChildren(node.children, styles.get(node.id), styles, boxes, x, y, availW, availH)
}

/**
 * Table layout over a list of children. Called with a table element's
 * children and style, or — for anonymous tables wrapped around stray
 * table-internal content (§17.2.1) — with the run of stray siblings and no
 * style (anonymous tables get initial values, e.g. border-spacing 0).
 */
function layoutTableChildren(
    children: TermNode[], tableStyle: ResolvedStyle | undefined,
    styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, availW: number, availH: number,
): { width: number; height: number } {
    const rows = collectTableRows(children, styles)
    const caption = findCaption(children, styles)
    if (rows.length === 0 && !caption) return { width: 0, height: 0 }

    const grid = buildTableGrid(rows)
    const gaps = tableGaps(tableStyle, rows, styles)
    const colWidths = measureColumnWidths(rows, grid, styles, boxes, availW, availH, tableStyle?.tableLayout ?? 'auto')
    // <col>/<colgroup> widths act as a minimum (auto) or as the source of
    // truth (fixed) for the column.
    const colHints = collectColHints(children, styles)
    for (let i = 0; i < colWidths.length; i++) {
        if (colHints[i] !== undefined) colWidths[i] = Math.max(colWidths[i], colHints[i])
    }
    const colsWidth = colWidths.reduce((sum, w) => sum + w, 0)
        + gaps.col * Math.max(0, colWidths.length - 1)

    // Measure caption against availW so the table can grow to fit it.
    let captionWidth = 0
    if (caption) {
        const size = layoutNode(caption, styles, boxes, 0, 0, availW, availH)
        captionWidth = size.width
    }

    const tableWidth = Math.max(colsWidth, captionWidth)
    const captionSide = caption ? styles.get(caption.id)?.captionSide ?? 'top' : 'top'

    let rowY = y
    if (caption && captionSide === 'top') {
        rowY += placeCaption(caption, styles, boxes, x, rowY, tableWidth, availH)
    }
    rowY += placeRows(rows, grid, styles, boxes, x, rowY, colWidths, tableWidth, availH, gaps)
    if (caption && captionSide === 'bottom') {
        rowY += placeCaption(caption, styles, boxes, x, rowY, tableWidth, availH)
    }

    return { width: tableWidth, height: rowY - y }
}

function layoutGrid(
    node: TermNode, styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, availW: number, availH: number, style: ResolvedStyle,
): { width: number; height: number } {
    const children = node.children.filter(c => c.nodeType === 'element' && styles.get(c.id)?.display !== 'none')
    if (children.length === 0) return { width: 0, height: 0 }

    const colWidths = parseGridTemplate(style.gridTemplateColumns ?? '', availW)
    const rowHeights = parseGridTemplate(style.gridTemplateRows ?? '', availH)
    const numCols = colWidths.length || 1
    const gap = style.gap ?? 0

    // Pre-compute border-adjusted gaps for grid children
    let hGap = gap
    let vGap = gap
    if (children.length >= 2) {
        // Check first two adjacent children for horizontal collapse
        if (numCols >= 2 && shouldAdjustBorderGap(styles.get(children[0].id), styles.get(children[1].id), 'horizontal')) {
            hGap = Math.max(-1, gap - 1)
        }
        // Check first child and first child of second row for vertical collapse
        if (children.length > numCols && shouldAdjustBorderGap(styles.get(children[0].id), styles.get(children[numCols].id), 'vertical')) {
            vGap = Math.max(-1, gap - 1)
        }
    }

    // Pass 1: assign each child to a row/col and compute content-based row heights
    interface GridPlacement { child: TermNode; col: number; span: number; row: number }
    const placements: GridPlacement[] = []
    const computedRowHeights: number[] = []
    let col = 0
    let rowIdx = 0

    for (const child of children) {
        const childStyle = styles.get(child.id)
        const span = childStyle?.gridColumnSpan ?? 1

        if (col >= numCols) { col = 0; rowIdx++ }

        const colStart = resolveGridColumnStart(childStyle, col, numCols)
        const colEnd = resolveGridColumnEnd(childStyle, colStart, span, numCols)
        const actualSpan = colEnd - colStart

        if (colStart > col) col = colStart
        if (col + actualSpan > numCols) { col = 0; rowIdx++ }

        const colW = columnSpanWidth(colWidths, col, actualSpan, hGap)
        // Measure content height with unconstrained available height
        const size = layoutNode(child, styles, boxes, 0, 0, colW, availH)

        placements.push({ child, col, span: actualSpan, row: rowIdx })
        if (!computedRowHeights[rowIdx]) computedRowHeights[rowIdx] = 0
        computedRowHeights[rowIdx] = Math.max(computedRowHeights[rowIdx], size.height)
        col += actualSpan
    }

    // Pass 2: layout each child at its final position with the correct row height
    let rowY = y
    let maxWidth = 0
    let prevRow = 0

    for (const { child, col, span, row } of placements) {
        // Advance rowY for new rows
        while (prevRow < row) {
            const rh = rowHeights[prevRow] ?? computedRowHeights[prevRow] ?? 0
            rowY += rh + vGap
            prevRow++
        }

        const colX = x + columnOffset(colWidths, col, hGap)
        const colW = columnSpanWidth(colWidths, col, span, hGap)
        const rh = rowHeights[row] ?? computedRowHeights[row] ?? 0

        layoutNode(child, styles, boxes, colX, rowY, colW, rh)

        const childBox = boxes.get(child.id)
        if (childBox) {
            childBox.width = colW
            childBox.height = rh
        }

        maxWidth = Math.max(maxWidth, colX - x + colW)
    }

    // Advance past the last row
    while (prevRow <= rowIdx) {
        if (prevRow === rowIdx) {
            const rh = rowHeights[prevRow] ?? computedRowHeights[prevRow] ?? 0
            return { width: maxWidth, height: (rowY - y) + rh }
        }
        const rh = rowHeights[prevRow] ?? computedRowHeights[prevRow] ?? 0
        rowY += rh + vGap
        prevRow++
    }

    return { width: maxWidth, height: rowY - y }
}

/** Resolve the start column for a grid item (0-indexed) */
function resolveGridColumnStart(style: ResolvedStyle | undefined, autoCol: number, numCols: number): number {
    if (!style) return autoCol
    if (style.gridColumnStart != null) return style.gridColumnStart - 1 // CSS lines are 1-indexed
    return autoCol
}

/** Resolve the end column for a grid item (0-indexed, exclusive) */
function resolveGridColumnEnd(style: ResolvedStyle | undefined, start: number, span: number, numCols: number): number {
    if (!style) return start + span
    if (style.gridColumnEnd != null) return style.gridColumnEnd - 1 // CSS lines are 1-indexed
    return start + span
}

/** Calculate pixel offset to the start of a column */
function columnOffset(colWidths: number[], col: number, gap: number): number {
    let offset = 0
    for (let i = 0; i < col; i++) {
        offset += colWidths[i] + gap
    }
    return offset
}

/** Calculate total width spanning multiple columns including gaps between them */
function columnSpanWidth(colWidths: number[], startCol: number, span: number, gap: number): number {
    let width = 0
    for (let i = startCol; i < startCol + span && i < colWidths.length; i++) {
        if (i > startCol) width += gap
        width += colWidths[i]
    }
    return width
}

function parseGridTemplate(template: string, availSize: number): number[] {
    if (!template) return []

    // Expand repeat() before splitting
    const expanded = expandRepeat(template)
    const parts = expanded.trim().split(/\s+/)
    return resolveTrackSizes(parts, availSize)
}

/** Expand repeat(N, tracks...) into flat track list */
function expandRepeat(template: string): string {
    return template.replace(
        /repeat\(\s*(\d+)\s*,\s*([^)]+)\)/g,
        (_match, countStr, tracks) => {
            const count = parseInt(countStr)
            const trackList = tracks.trim()
            return Array(count).fill(trackList).join(' ')
        },
    )
}

function resolveTrackSizes(parts: string[], availSize: number): number[] {
    const sizes: number[] = []
    const frParts: { index: number; fr: number }[] = []
    let fixedTotal = 0

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const cellLength = parseCellLength(part)
        if (cellLength !== null) {
            const w = Math.round(cellLength)
            sizes.push(w)
            fixedTotal += w
        } else if (part.endsWith('%')) {
            const w = Math.floor(availSize * parseFloat(part) / 100)
            sizes.push(w)
            fixedTotal += w
        } else if (part.endsWith('fr')) {
            const fr = parseFloat(part)
            sizes.push(0) // placeholder
            frParts.push({ index: i, fr })
        } else {
            sizes.push(0)
        }
    }

    // Distribute remaining space to fr units
    if (frParts.length > 0) {
        const totalFr = frParts.reduce((sum, p) => sum + p.fr, 0)
        const remaining = Math.max(0, availSize - fixedTotal)
        for (const { index, fr } of frParts) {
            sizes[index] = Math.floor(remaining * fr / totalFr)
        }
    }

    return sizes
}

function positionChildren(
    children: TermNode[], styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    innerX: number, innerY: number, innerW: number, innerH: number,
    dir: ResolvedStyle['flexDirection'], gap: number,
    justify: ResolvedStyle['justifyContent'], align: ResolvedStyle['alignItems'],
    wrap: 'nowrap' | 'wrap' = 'nowrap',
): { width: number; height: number } {
    // Layout absolute children first (they don't affect flow)
    for (const child of children) {
        const s = styles.get(child.id)
        if (s?.position === 'absolute' || s?.position === 'fixed') {
            layoutNode(child, styles, boxes, innerX, innerY, innerW, innerH)
        }
    }

    // Flatten display:contents children into the list
    const flatChildren = flattenContents(children, styles)

    const visible = flatChildren.filter(c => {
        if (c.nodeType === 'comment') return false
        const s = styles.get(c.id)
        if (s?.display === 'none') return false
        if (s?.position === 'absolute' || s?.position === 'fixed') return false
        return true
    })
    if (visible.length === 0) return { width: 0, height: 0 }

    const isReverse = dir === 'row-reverse' || dir === 'column-reverse'
    const baseDir = (dir === 'row' || dir === 'row-reverse') ? 'row' : 'column'

    // Pre-measure to filter out zero-size items (e.g. whitespace text nodes)
    const measured = visible.map(child => ({
        child,
        size: layoutNode(child, styles, boxes, 0, 0, innerW, innerH),
    }))
    const nonEmpty = measured.filter(({ size }) => size.width > 0 || size.height > 0)
    if (nonEmpty.length === 0) return { width: 0, height: 0 }

    // Sort by order property, then handle reverse
    const sorted = [...nonEmpty].sort((a, b) => {
        const orderA = styles.get(a.child.id)?.order ?? 0
        const orderB = styles.get(b.child.id)?.order ?? 0
        return orderA - orderB
    })
    const orderedItems = isReverse ? sorted.reverse() : sorted
    const ordered = orderedItems.map(item => item.child)

    // Use pre-measured sizes, overridden by flex-basis when set
    const sizes = orderedItems.map(item => {
        const s = styles.get(item.child.id)
        const basis = s?.flexBasis
        if (basis !== undefined && basis !== 'auto') {
            const basisValue = typeof basis === 'number' ? basis : 0
            return baseDir === 'row'
                ? { width: basisValue, height: item.size.height }
                : { width: item.size.width, height: basisValue }
        }
        return item.size
    })
    const growValues = ordered.map(child => styles.get(child.id)?.flexGrow ?? 0)
    const shrinkValues = ordered.map(child => styles.get(child.id)?.flexShrink ?? 1)
    const totalGrow = growValues.reduce((a, b) => a + b, 0)

    // Compute per-pair gap, adjusting for border collapse
    const borderDir = baseDir === 'column' ? 'vertical' as const : 'horizontal' as const
    const pairGaps = ordered.map((child, i) => {
        if (i === 0) return 0
        const adjust = shouldAdjustBorderGap(
            styles.get(ordered[i - 1].id), styles.get(child.id), borderDir,
        ) ? 1 : 0
        return Math.max(-1, gap - adjust)
    })

    const totalMain = sizes.reduce((sum, s, i) => {
        return sum + (baseDir === 'row' ? s.width : s.height) + pairGaps[i]
    }, 0)

    const availMain = baseDir === 'row' ? innerW : innerH
    const rawFreeSpace = availMain - totalMain
    const freeSpace = Math.max(0, rawFreeSpace)
    // With wrapping enabled, items wrap instead of shrinking
    const overflow = wrap === 'wrap' ? 0 : Math.max(0, -rawFreeSpace)
    const hasGrow = totalGrow > 0
    const totalShrink = overflow > 0 ? shrinkValues.reduce((a, b) => a + b, 0) : 0

    // Pre-compute grow/shrink adjustments with correct rounding
    const mainAdjust = new Array<number>(ordered.length).fill(0)
    if (hasGrow && freeSpace > 0) {
        let distributed = 0
        for (let i = 0; i < ordered.length; i++) {
            if (growValues[i] > 0) {
                const share = Math.floor(freeSpace * growValues[i] / totalGrow)
                mainAdjust[i] = share
                distributed += share
            }
        }
        // Distribute remainder 1px each to items with largest fractional parts
        let remainder = freeSpace - distributed
        if (remainder > 0) {
            const fractions = ordered.map((_, i) =>
                growValues[i] > 0 ? (freeSpace * growValues[i] / totalGrow) % 1 : 0
            )
            const indices = ordered.map((_, i) => i)
                .filter(i => growValues[i] > 0)
                .sort((a, b) => fractions[b] - fractions[a])
            for (const idx of indices) {
                if (remainder <= 0) break
                mainAdjust[idx] += 1
                remainder--
            }
        }
    }
    if (overflow > 0 && totalShrink > 0) {
        let distributed = 0
        for (let i = 0; i < ordered.length; i++) {
            if (shrinkValues[i] > 0) {
                const childStyle = styles.get(ordered[i].id)
                const explicitMain = baseDir === 'row' ? childStyle?.width : childStyle?.height
                if (explicitMain != null) {
                    const share = Math.floor(overflow * shrinkValues[i] / totalShrink)
                    mainAdjust[i] = -share
                    distributed += share
                }
            }
        }
        // Distribute remainder to last shrinking item with explicit size
        let remainder = overflow - distributed
        for (let i = ordered.length - 1; i >= 0 && remainder > 0; i--) {
            if (shrinkValues[i] > 0) {
                const childStyle = styles.get(ordered[i].id)
                const explicitMain = baseDir === 'row' ? childStyle?.width : childStyle?.height
                if (explicitMain != null) {
                    mainAdjust[i] -= remainder
                    remainder = 0
                }
            }
        }
    }

    // Apply min-width/min-height constraints to shrink adjustments.
    // CSS Flexbox §4.5: items have auto min-size = min(content-size, specified-size).
    // Approximate content-min as: borders in main axis + (1 if has children, else 0).
    // overflow:hidden allows min to be 0 (per spec).
    for (let i = 0; i < ordered.length; i++) {
        if (mainAdjust[i] < 0) {
            const baseSize = baseDir === 'row' ? sizes[i].width : sizes[i].height
            const childStyle = styles.get(ordered[i].id)
            const minMain = baseDir === 'row' ? childStyle?.minWidth : childStyle?.minHeight
            if (minMain != null) {
                const adjusted = baseSize + mainAdjust[i]
                if (adjusted < minMain) mainAdjust[i] = minMain - baseSize
            } else {
                const autoMin = autoMinMainSize(ordered[i], childStyle, baseDir)
                if (baseSize + mainAdjust[i] < autoMin) mainAdjust[i] = autoMin - baseSize
            }
            // Never shrink below 0
            if (baseSize + mainAdjust[i] < 0) mainAdjust[i] = -baseSize
        }
    }

    // Apply max-width/max-height constraints to grow adjustments
    for (let i = 0; i < ordered.length; i++) {
        if (mainAdjust[i] > 0) {
            const baseSize = baseDir === 'row' ? sizes[i].width : sizes[i].height
            const childStyle = styles.get(ordered[i].id)
            const maxMain = baseDir === 'row' ? childStyle?.maxWidth : childStyle?.maxHeight
            if (maxMain != null) {
                const adjusted = baseSize + mainAdjust[i]
                if (adjusted > maxMain) {
                    const excess = adjusted - maxMain
                    mainAdjust[i] -= excess
                    // Redistribute excess to other growing items
                    for (let j = 0; j < ordered.length; j++) {
                        if (j !== i && growValues[j] > 0) {
                            mainAdjust[j] += excess
                            break
                        }
                    }
                }
            }
        }
    }

    // §9.8.1 Auto margins absorb free space before justify-content
    const autoMargins: { before: number; after: number }[] = ordered.map(() => ({ before: 0, after: 0 }))
    if (freeSpace > 0 && !hasGrow) {
        const marginProp = baseDir === 'row'
            ? { before: 'marginLeft' as const, after: 'marginRight' as const }
            : { before: 'marginTop' as const, after: 'marginBottom' as const }
        let autoCount = 0
        for (let i = 0; i < ordered.length; i++) {
            const s = styles.get(ordered[i].id)
            if (s && s[marginProp.before] === -1) autoCount++
            if (s && s[marginProp.after] === -1) autoCount++
        }
        if (autoCount > 0) {
            const perAuto = Math.floor(freeSpace / autoCount)
            let distributed = 0
            for (let i = 0; i < ordered.length; i++) {
                const s = styles.get(ordered[i].id)
                if (s && s[marginProp.before] === -1) {
                    autoMargins[i].before = perAuto
                    distributed += perAuto
                }
                if (s && s[marginProp.after] === -1) {
                    autoMargins[i].after = perAuto
                    distributed += perAuto
                }
            }
            // Distribute remainder to last auto margin
            let remainder = freeSpace - distributed
            for (let i = ordered.length - 1; i >= 0 && remainder > 0; i--) {
                const s = styles.get(ordered[i].id)
                if (s && s[marginProp.after] === -1) {
                    autoMargins[i].after += remainder; remainder = 0
                } else if (s && s[marginProp.before] === -1) {
                    autoMargins[i].before += remainder; remainder = 0
                }
            }
        }
    }
    const hasAutoMargins = autoMargins.some(m => m.before > 0 || m.after > 0)

    // For wrapping, first determine line breaks and per-line cross sizes
    const itemLine: number[] = []  // which line each item is on
    const lineHeights: number[] = []  // cross size per line
    if (wrap === 'wrap') {
        let lineMainPos = 0
        let currentLine = 0
        let currentLineHeight = 0
        for (let i = 0; i < ordered.length; i++) {
            const contentMainSize = baseDir === 'row' ? sizes[i].width : sizes[i].height
            if (lineMainPos + contentMainSize > availMain && i > 0) {
                lineHeights.push(currentLineHeight)
                currentLine++
                lineMainPos = 0
                currentLineHeight = 0
            }
            itemLine.push(currentLine)
            const crossSize = baseDir === 'row' ? sizes[i].height : sizes[i].width
            currentLineHeight = Math.max(currentLineHeight, crossSize)
            lineMainPos += contentMainSize + (i < ordered.length - 1 ? pairGaps[i + 1] : 0)
        }
        lineHeights.push(currentLineHeight)
    }

    // Position
    let mainPos = hasAutoMargins ? 0 : computeMainStart(justify, rawFreeSpace, ordered.length, hasGrow)
    const baseItemGap = hasAutoMargins ? gap : computeItemGap(justify, gap, freeSpace, ordered.length, hasGrow)

    let contentWidth = 0
    let contentHeight = 0
    let crossPos = 0
    let lineHeight = 0
    let currentLine = 0
    let naturalMain = 0

    for (let i = 0; i < ordered.length; i++) {
        mainPos += autoMargins[i].before

        let mainSize = (baseDir === 'row' ? sizes[i].width : sizes[i].height) + mainAdjust[i]
        mainSize = Math.max(0, mainSize)

        // Wrap check
        const contentMainSize = baseDir === 'row' ? sizes[i].width : sizes[i].height
        if (wrap === 'wrap' && mainPos + contentMainSize > availMain && i > 0) {
            // Border collapse between wrap lines: reduce gap when adjacent
            // items have borders on the shared edge
            const crossDir = baseDir === 'row' ? 'vertical' as const : 'horizontal' as const
            const prevLineItem = ordered[i - 1]
            const prevStyle = styles.get(prevLineItem.id)
            const curStyle = styles.get(ordered[i].id)
            const collapseGap = shouldAdjustBorderGap(prevStyle, curStyle, crossDir) ? 1 : 0
            crossPos += lineHeight + Math.max(-1, gap - collapseGap)
            mainPos = 0
            lineHeight = 0
            currentLine++
        }

        const crossSize = baseDir === 'row' ? sizes[i].height : sizes[i].width
        // In wrap mode, cross available is the line height; otherwise full container
        const lineCrossSize = wrap === 'wrap' ? lineHeights[currentLine] : 0
        const crossAvail = wrap === 'wrap' ? lineCrossSize : (baseDir === 'row' ? innerH : innerW)

        const childStyle = styles.get(ordered[i].id)
        const selfAlign: ResolvedStyle['alignItems'] = childStyle?.alignSelf !== 'auto'
            ? (childStyle?.alignSelf as ResolvedStyle['alignItems']) ?? align
            : align
        // Stretch only applies to items whose cross-axis size is auto (§8.3);
        // an explicit width/height wins and the item aligns to the line start.
        const crossSizeIsAuto = baseDir === 'row'
            ? childStyle?.height == null
            : childStyle?.width == null
        const isStretch = selfAlign === 'stretch' && crossSizeIsAuto
        const crossOffset = isStretch ? 0 : computeCrossOffset(selfAlign, crossAvail, crossSize)

        const finalCx = baseDir === 'row' ? innerX + mainPos : innerX + crossOffset
        const finalCy = baseDir === 'row' ? innerY + crossPos + crossOffset : innerY + mainPos

        const childAvailW = baseDir === 'row' ? mainSize : innerW
        const childAvailH = baseDir === 'row' ? (isStretch ? crossAvail : innerH) : mainSize
        layoutNode(ordered[i], styles, boxes, finalCx, finalCy, childAvailW, childAvailH)

        const box = boxes.get(ordered[i].id)
        if (box) {
            if (baseDir === 'row' && box.width !== mainSize) box.width = mainSize
            if (baseDir === 'column' && box.height !== mainSize) box.height = mainSize
            if (isStretch) {
                if (baseDir === 'row' && box.height < crossAvail) {
                    const stretchH = constrain(crossAvail, childStyle?.minHeight, childStyle?.maxHeight)
                    box.height = stretchH
                    layoutNode(ordered[i], styles, boxes, finalCx, finalCy, mainSize, stretchH)
                    const rebox = boxes.get(ordered[i].id)
                    if (rebox) { rebox.width = mainSize; rebox.height = stretchH }
                }
                if (baseDir === 'column' && box.width < crossAvail) {
                    const stretchW = constrain(crossAvail, childStyle?.minWidth, childStyle?.maxWidth)
                    box.width = stretchW
                    layoutNode(ordered[i], styles, boxes, finalCx, finalCy, stretchW, mainSize)
                    const rebox = boxes.get(ordered[i].id)
                    if (rebox) { rebox.width = stretchW; rebox.height = mainSize }
                }
            }
        }

        lineHeight = Math.max(lineHeight, crossSize)
        const usesJustifySpacing = justify === 'space-between' || justify === 'space-around' || justify === 'space-evenly'
        const pairItemGap = i < ordered.length - 1
            ? (usesJustifySpacing && !hasGrow ? baseItemGap : pairGaps[i + 1])
            : 0
        mainPos += mainSize + autoMargins[i].after + pairItemGap
        naturalMain += mainSize + (i > 0 ? pairGaps[i] : 0)
        contentWidth = baseDir === 'row' ? Math.max(contentWidth, mainPos) : Math.max(contentWidth, sizes[i].width)
        contentHeight = baseDir === 'row' ? crossPos + lineHeight : mainPos
    }

    // Return natural size for shrink-wrap auto-sizing (no justify offset).
    // For wrapping containers, use positioned extent (wrapping already happened).
    const mainResult = wrap === 'wrap' ? (baseDir === 'row' ? contentWidth : contentHeight) : naturalMain
    return baseDir === 'row'
        ? { width: mainResult, height: contentHeight }
        : { width: contentWidth, height: mainResult }
}
