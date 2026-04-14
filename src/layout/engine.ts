import { TermNode } from '../renderer/node.js'
import { ResolvedStyle, type StyleMap } from '../css/compute.js'
import { NodeMap } from '../utils/node-map.js'

export type LayoutMap = NodeMap<LayoutBox>
import { computeMainStart, computeItemGap, computeCrossOffset } from './flex.js'
import { measureText } from './text.js'
import { resolveSize, constrain } from './size.js'

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
    const inset = {
        top: resolvePadding(style?.paddingTop, availWidth) + borderWidth,
        right: resolvePadding(style?.paddingRight, availWidth) + borderWidth,
        bottom: resolvePadding(style?.paddingBottom, availWidth) + borderWidth,
        left: resolvePadding(style?.paddingLeft, availWidth) + borderWidth,
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
    const explicitWidth = resolveSize(style?.width, availWidth - margin.left - margin.right)
    // Flex/grid children are sized by their parent algorithm, not clamped to available width
    const nodeWidth = explicitWidth !== null
        ? (isFlexOrGridChild ? explicitWidth : Math.min(explicitWidth, availWidth - margin.left - margin.right))
        : null
    const nodeHeight = resolveSize(style?.height, availHeight - margin.top - margin.bottom)

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
    } else if (display === 'table') {
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
    const autoWidth = isBlock
        ? (availWidth - margin.left - margin.right)
        : content.width + inset.left + inset.right
    // Input/textarea have intrinsic minimum height of 1 row for the value text
    const intrinsicHeight = (node.tag === 'input' || node.tag === 'textarea')
        ? Math.max(content.height, 1)
        : content.height
    const autoHeight = intrinsicHeight + inset.top + inset.bottom
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
    const inset = {
        top: resolvePadding(style.paddingTop, availWidth) + borderWidth,
        right: resolvePadding(style.paddingRight, availWidth) + borderWidth,
        bottom: resolvePadding(style.paddingBottom, availWidth) + borderWidth,
        left: resolvePadding(style.paddingLeft, availWidth) + borderWidth,
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

    for (const child of flatChildren) {
        if (child.nodeType === 'comment') continue
        const s = styles.get(child.id)
        if (s?.display === 'none') continue
        if (s?.position === 'absolute' || s?.position === 'fixed') continue

        const isInline = child.nodeType === 'text' || s?.display === 'inline' || s?.display === 'inline-block'

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

function layoutTable(
    node: TermNode, styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, availW: number, availH: number,
): { width: number; height: number } {
    // Collect rows and cells
    const rows: TermNode[][] = []
    for (const child of node.children) {
        if (child.tag === 'tr') {
            const cells = child.children.filter(c => c.tag === 'td' || c.tag === 'th')
            rows.push(cells)
        }
    }

    if (rows.length === 0) return { width: 0, height: 0 }

    const numCols = Math.max(...rows.map(r => r.length))
    const colWidths: number[] = new Array(numCols).fill(0)

    // First pass: measure all cells to find max column widths
    for (const row of rows) {
        for (let col = 0; col < row.length; col++) {
            const cell = row[col]
            const size = layoutNode(cell, styles, boxes, 0, 0, availW, availH)
            colWidths[col] = Math.max(colWidths[col], size.width)
        }
    }

    // Add 2 cells padding between columns
    const colGap = 2

    // Second pass: position cells with aligned columns
    let rowY = y
    for (const row of rows) {
        let colX = x
        let rowHeight = 0
        // Layout the tr element
        const trNode = node.children.find(c => c.tag === 'tr' && c.children.includes(row[0]))

        for (let col = 0; col < row.length; col++) {
            const cell = row[col]
            const size = layoutNode(cell, styles, boxes, colX, rowY, colWidths[col], availH)
            // Table cells fill their column width
            const cellBox = boxes.get(cell.id)
            if (cellBox && cellBox.width < colWidths[col]) cellBox.width = colWidths[col]
            rowHeight = Math.max(rowHeight, size.height)
            colX += colWidths[col] + colGap
        }

        if (trNode) {
            const trWidth = colWidths.reduce((sum, w) => sum + w, 0) + colGap * (numCols - 1)
            boxes.set(trNode.id, { x, y: rowY, width: trWidth, height: rowHeight })
        }

        rowY += rowHeight
    }

    const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + colGap * Math.max(0, numCols - 1)
    return { width: totalWidth, height: rowY - y }
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
        if (part.endsWith('cell')) {
            const w = Math.round(parseFloat(part))
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

    // Apply min-width/min-height constraints to shrink adjustments
    for (let i = 0; i < ordered.length; i++) {
        if (mainAdjust[i] < 0) {
            const baseSize = baseDir === 'row' ? sizes[i].width : sizes[i].height
            const childStyle = styles.get(ordered[i].id)
            const minMain = baseDir === 'row' ? childStyle?.minWidth : childStyle?.minHeight
            if (minMain != null) {
                const adjusted = baseSize + mainAdjust[i]
                if (adjusted < minMain) mainAdjust[i] = minMain - baseSize
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
        const isStretch = selfAlign === 'stretch'
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
