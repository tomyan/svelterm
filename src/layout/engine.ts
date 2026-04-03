import { TermNode } from '../renderer/node.js'
import { ResolvedStyle } from '../css/compute.js'
import { computeMainStart, computeItemGap, computeCrossOffset } from './flex.js'
import { measureText } from './text.js'
import { resolveSize, constrain } from './size.js'

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
    const boxes = new Map<number, LayoutBox>()
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
    if (text === '') {
        boxes.set(node.id, { x, y, width: 0, height: 0 })
        return { width: 0, height: 0 }
    }

    // Check parent's whiteSpace
    const parentStyle = node.parent ? styles?.get(node.parent.id) : undefined
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

    // Absolute positioning: use top/left offsets relative to parent, don't consume space in flow
    if (style?.position === 'absolute' || style?.position === 'fixed') {
        const absX = x + (style.left ?? 0)
        const absY = y + (style.top ?? 0)
        return layoutAbsolute(node, styles, boxes, absX, absY, availWidth, availHeight, style)
    }

    let margin = {
        top: style?.marginTop ?? 0, right: style?.marginRight ?? 0,
        bottom: style?.marginBottom ?? 0, left: style?.marginLeft ?? 0,
    }
    const borderWidth = (style?.borderStyle && style.borderStyle !== 'none') ? 1 : 0
    const inset = {
        top: (style?.paddingTop ?? 0) + borderWidth,
        right: (style?.paddingRight ?? 0) + borderWidth,
        bottom: (style?.paddingBottom ?? 0) + borderWidth,
        left: (style?.paddingLeft ?? 0) + borderWidth,
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
    const explicitWidth = resolveSize(style?.width, availWidth - margin.left - margin.right)
    const nodeWidth = explicitWidth !== null ? Math.min(explicitWidth, availWidth - margin.left - margin.right) : null
    const nodeHeight = resolveSize(style?.height, availHeight - margin.top - margin.bottom)

    const innerW = (nodeWidth ?? (availWidth - margin.left - margin.right)) - inset.left - inset.right
    const innerH = (nodeHeight ?? (availHeight - margin.top - margin.bottom)) - inset.top - inset.bottom

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
    } else {
        // block or inline — use block flow (inline children flow horizontally within)
        content = layoutBlockFlow(node.children, styles, boxes, boxX + inset.left, boxY + inset.top, innerW, innerH)
    }

    const autoWidth = (style?.flexGrow ?? 0) > 0 ? (availWidth - margin.left - margin.right) : content.width + inset.left + inset.right
    const autoHeight = content.height + inset.top + inset.bottom
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
        top: (style.paddingTop ?? 0) + borderWidth,
        right: (style.paddingRight ?? 0) + borderWidth,
        bottom: (style.paddingBottom ?? 0) + borderWidth,
        left: (style.paddingLeft ?? 0) + borderWidth,
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

    for (const child of children) {
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
            const childMarginTop = s?.marginTop ?? 0
            if (prevBlockMarginBottom > 0 && childMarginTop > 0) {
                const collapsed = Math.max(prevBlockMarginBottom, childMarginTop)
                const overlap = prevBlockMarginBottom + childMarginTop - collapsed
                cursorY -= overlap
            }

            const size = layoutNode(child, styles, boxes, x, cursorY, availW, availH - (cursorY - y))
            cursorY += size.height
            maxWidth = Math.max(maxWidth, size.width)
            prevBlockMarginBottom = s?.marginBottom ?? 0
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

    const visible = children.filter(c => {
        if (c.nodeType === 'comment') return false
        const s = styles.get(c.id)
        if (s?.display === 'none') return false
        if (s?.position === 'absolute' || s?.position === 'fixed') return false
        return true
    })
    if (visible.length === 0) return { width: 0, height: 0 }

    // Sort by order property, then handle reverse
    const sorted = [...visible].sort((a, b) => {
        const orderA = styles.get(a.id)?.order ?? 0
        const orderB = styles.get(b.id)?.order ?? 0
        return orderA - orderB
    })
    const isReverse = dir === 'row-reverse' || dir === 'column-reverse'
    const baseDir = (dir === 'row' || dir === 'row-reverse') ? 'row' : 'column'
    const ordered = isReverse ? sorted.reverse() : sorted

    // Measure
    const sizes = ordered.map(child => layoutNode(child, styles, boxes, 0, 0, innerW, innerH))
    const growValues = ordered.map(child => styles.get(child.id)?.flexGrow ?? 0)
    const shrinkValues = ordered.map(child => styles.get(child.id)?.flexShrink ?? 1)
    const totalGrow = growValues.reduce((a, b) => a + b, 0)

    const totalMain = sizes.reduce((sum, s, i) => {
        return sum + (baseDir === 'row' ? s.width : s.height) + (i > 0 ? gap : 0)
    }, 0)

    const availMain = baseDir === 'row' ? innerW : innerH
    const freeSpace = Math.max(0, availMain - totalMain)
    const overflow = Math.max(0, totalMain - availMain)
    const hasGrow = totalGrow > 0
    const totalShrink = overflow > 0 ? shrinkValues.reduce((a, b) => a + b, 0) : 0

    // Position
    let mainPos = computeMainStart(justify, freeSpace, ordered.length, hasGrow)
    const itemGap = computeItemGap(justify, gap, freeSpace, ordered.length, hasGrow)

    let contentWidth = 0
    let contentHeight = 0
    let crossPos = 0
    let lineHeight = 0

    for (let i = 0; i < ordered.length; i++) {
        let mainSize = baseDir === 'row' ? sizes[i].width : sizes[i].height
        if (hasGrow && growValues[i] > 0) {
            mainSize += Math.floor(freeSpace * growValues[i] / totalGrow)
        }
        if (overflow > 0 && totalShrink > 0 && shrinkValues[i] > 0) {
            mainSize -= Math.floor(overflow * shrinkValues[i] / totalShrink)
            mainSize = Math.max(0, mainSize)
        }

        // Wrap check
        if (wrap === 'wrap' && mainPos + mainSize > availMain && i > 0) {
            crossPos += lineHeight + gap
            mainPos = 0
            lineHeight = 0
        }

        const crossSize = baseDir === 'row' ? sizes[i].height : sizes[i].width
        const crossAvail = baseDir === 'row' ? innerH : innerW

        // Check align-self
        const childStyle = styles.get(ordered[i].id)
        const selfAlign = childStyle?.alignSelf !== 'auto' ? (childStyle?.alignSelf ?? align) : align
        const crossOffset = computeCrossOffset(selfAlign as any, crossAvail, crossSize)

        const finalCx = baseDir === 'row' ? innerX + mainPos : innerX + crossOffset
        const finalCy = baseDir === 'row' ? innerY + crossPos + crossOffset : innerY + mainPos

        const childAvailW = baseDir === 'row' ? mainSize : innerW
        const childAvailH = baseDir === 'row' ? innerH : mainSize
        layoutNode(ordered[i], styles, boxes, finalCx, finalCy, childAvailW, childAvailH)

        lineHeight = Math.max(lineHeight, baseDir === 'row' ? sizes[i].height : sizes[i].width)
        mainPos += mainSize + (i < ordered.length - 1 ? itemGap : 0)
        contentWidth = baseDir === 'row' ? Math.max(contentWidth, mainPos) : Math.max(contentWidth, sizes[i].width)
        contentHeight = baseDir === 'row' ? crossPos + lineHeight : mainPos
    }

    return { width: contentWidth, height: contentHeight }
}
