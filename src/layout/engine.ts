import { TermNode } from '../renderer/node.js'
import { ResolvedStyle } from '../css/compute.js'

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
    x: number,
    y: number,
    availWidth: number,
    availHeight: number,
): { width: number; height: number } {
    if (node.nodeType === 'text') {
        const text = node.text ?? ''
        const w = text.length
        const h = w > 0 ? 1 : 0
        boxes.set(node.id, { x, y, width: w, height: h })
        return { width: w, height: h }
    }

    if (node.nodeType === 'comment') {
        return { width: 0, height: 0 }
    }

    if (node.nodeType === 'fragment') {
        return layoutChildren(node, styles, boxes, x, y, availWidth, availHeight, 'column', 0, 0, 0, 0, 0, 'start', 'start')
    }

    const style = styles.get(node.id)
    if (style?.display === 'none') {
        return { width: 0, height: 0 }
    }

    const dir = style?.flexDirection ?? 'column'
    const gap = style?.gap ?? 0
    const pTop = style?.paddingTop ?? 0
    const pRight = style?.paddingRight ?? 0
    const pBottom = style?.paddingBottom ?? 0
    const pLeft = style?.paddingLeft ?? 0
    const justify = style?.justifyContent ?? 'start'
    const align = style?.alignItems ?? 'start'

    // Resolve explicit size
    let nodeWidth = resolveSize(style?.width, availWidth)
    let nodeHeight = resolveSize(style?.height, availHeight)

    const innerAvailW = (nodeWidth ?? availWidth) - pLeft - pRight
    const innerAvailH = (nodeHeight ?? availHeight) - pTop - pBottom

    // Layout children
    const contentSize = layoutChildren(
        node, styles, boxes,
        x + pLeft, y + pTop,
        innerAvailW, innerAvailH,
        dir, gap, pTop, pRight, pBottom, pLeft,
        justify, align,
    )

    // Determine final size
    const finalWidth = nodeWidth ?? (contentSize.width + pLeft + pRight)
    const finalHeight = nodeHeight ?? (contentSize.height + pTop + pBottom)

    // Apply min/max constraints
    const constrainedWidth = constrain(finalWidth, style?.minWidth, style?.maxWidth)
    const constrainedHeight = constrain(finalHeight, style?.minHeight, style?.maxHeight)

    boxes.set(node.id, { x, y, width: constrainedWidth, height: constrainedHeight })
    return { width: constrainedWidth, height: constrainedHeight }
}

function layoutChildren(
    node: TermNode,
    styles: Map<number, ResolvedStyle>,
    boxes: Map<number, LayoutBox>,
    innerX: number,
    innerY: number,
    innerW: number,
    innerH: number,
    dir: 'row' | 'column',
    gap: number,
    _pTop: number,
    _pRight: number,
    _pBottom: number,
    _pLeft: number,
    justify: ResolvedStyle['justifyContent'],
    align: ResolvedStyle['alignItems'],
): { width: number; height: number } {
    const children = node.children.filter(c => {
        if (c.nodeType === 'comment') return false
        const s = styles.get(c.id)
        return s?.display !== 'none'
    })

    if (children.length === 0) return { width: 0, height: 0 }

    // First pass: measure children
    const childSizes: { width: number; height: number }[] = []
    const childStyles: (ResolvedStyle | undefined)[] = []

    for (const child of children) {
        const cs = styles.get(child.id)
        childStyles.push(cs)
        const size = layoutNode(child, styles, boxes, 0, 0, innerW, innerH)
        childSizes.push(size)
    }

    // Second pass: distribute flex-grow space
    const totalMain = childSizes.reduce((sum, s, i) => {
        const mainSize = dir === 'row' ? s.width : s.height
        return sum + mainSize + (i > 0 ? gap : 0)
    }, 0)

    const availMain = dir === 'row' ? innerW : innerH
    const freeSpace = Math.max(0, availMain - totalMain)

    const totalGrow = childStyles.reduce((sum, cs) => sum + (cs?.flexGrow ?? 0), 0)

    // Third pass: position children
    let mainPos = computeMainStart(justify, freeSpace, children.length, gap, totalGrow > 0)
    let contentWidth = 0
    let contentHeight = 0

    for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const size = childSizes[i]
        const cs = childStyles[i]

        // Add flex-grow space
        let mainSize = dir === 'row' ? size.width : size.height
        if (totalGrow > 0 && (cs?.flexGrow ?? 0) > 0) {
            mainSize += Math.floor(freeSpace * (cs!.flexGrow / totalGrow))
        }

        // Cross axis alignment
        const crossSize = dir === 'row' ? size.height : size.width
        const crossAvail = dir === 'row' ? innerH : innerW
        const crossOffset = computeCrossOffset(align, crossAvail, crossSize)

        // Position
        let cx: number, cy: number, cw: number, ch: number
        if (dir === 'row') {
            cx = innerX + mainPos
            cy = innerY + crossOffset
            cw = mainSize
            ch = size.height
        } else {
            cx = innerX + crossOffset
            cy = innerY + mainPos
            cw = size.width
            ch = mainSize
        }

        // Update the child's box (re-layout with correct position)
        layoutNode(child, styles, boxes, cx, cy, cw, ch)

        mainPos += mainSize + computeGap(justify, gap, freeSpace, children.length, i, totalGrow > 0)

        contentWidth = dir === 'row'
            ? mainPos
            : Math.max(contentWidth, size.width)
        contentHeight = dir === 'column'
            ? mainPos
            : Math.max(contentHeight, size.height)
    }

    if (dir === 'row') {
        contentWidth = mainPos
    } else {
        contentHeight = mainPos
    }

    return { width: contentWidth, height: contentHeight }
}

function computeMainStart(
    justify: ResolvedStyle['justifyContent'],
    freeSpace: number,
    count: number,
    _gap: number,
    hasGrow: boolean,
): number {
    if (hasGrow) return 0
    switch (justify) {
        case 'end': return freeSpace
        case 'center': return Math.floor(freeSpace / 2)
        case 'space-between': return 0
        case 'space-around': return count > 0 ? Math.floor(freeSpace / (count * 2)) : 0
        case 'space-evenly': return count > 0 ? Math.floor(freeSpace / (count + 1)) : 0
        default: return 0
    }
}

function computeGap(
    justify: ResolvedStyle['justifyContent'],
    gap: number,
    freeSpace: number,
    count: number,
    index: number,
    hasGrow: boolean,
): number {
    if (hasGrow) return gap
    if (index >= count - 1) return 0

    switch (justify) {
        case 'space-between':
            return count > 1 ? Math.floor(freeSpace / (count - 1)) : gap
        case 'space-around':
            return count > 0 ? Math.floor(freeSpace / count) : gap
        case 'space-evenly':
            return count > 0 ? Math.floor(freeSpace / (count + 1)) : gap
        default:
            return gap
    }
}

function computeCrossOffset(
    align: ResolvedStyle['alignItems'],
    crossAvail: number,
    crossSize: number,
): number {
    switch (align) {
        case 'end': return crossAvail - crossSize
        case 'center': return Math.floor((crossAvail - crossSize) / 2)
        default: return 0
    }
}

function resolveSize(value: number | string | null | undefined, available: number): number | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.endsWith('%')) {
        const pct = parseFloat(value) / 100
        return Math.floor(available * pct)
    }
    return null
}

function constrain(value: number, min: number | null | undefined, max: number | null | undefined): number {
    let result = value
    if (min != null) result = Math.max(result, min)
    if (max != null) result = Math.min(result, max)
    return result
}
