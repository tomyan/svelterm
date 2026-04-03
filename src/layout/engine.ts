import { TermNode } from '../renderer/node.js'
import { ResolvedStyle } from '../css/compute.js'
import { computeMainStart, computeItemGap, computeCrossOffset } from './flex.js'
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
    if (node.nodeType === 'text') return layoutText(node, boxes, x, y)
    if (node.nodeType === 'comment') return { width: 0, height: 0 }
    if (node.nodeType === 'fragment') return layoutFragment(node, styles, boxes, x, y, availWidth, availHeight)
    return layoutElement(node, styles, boxes, x, y, availWidth, availHeight)
}

function layoutText(node: TermNode, boxes: Map<number, LayoutBox>, x: number, y: number) {
    const text = node.text ?? ''
    const w = text.length
    const h = w > 0 ? 1 : 0
    boxes.set(node.id, { x, y, width: w, height: h })
    return { width: w, height: h }
}

function layoutFragment(
    node: TermNode, styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, availWidth: number, availHeight: number,
) {
    return positionChildren(node.children, styles, boxes, x, y, availWidth, availHeight, 'column', 0, 'start', 'start')
}

function layoutElement(
    node: TermNode, styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    x: number, y: number, availWidth: number, availHeight: number,
) {
    const style = styles.get(node.id)
    if (style?.display === 'none') return { width: 0, height: 0 }

    const pad = {
        top: style?.paddingTop ?? 0, right: style?.paddingRight ?? 0,
        bottom: style?.paddingBottom ?? 0, left: style?.paddingLeft ?? 0,
    }
    const nodeWidth = resolveSize(style?.width, availWidth)
    const nodeHeight = resolveSize(style?.height, availHeight)

    const innerW = (nodeWidth ?? availWidth) - pad.left - pad.right
    const innerH = (nodeHeight ?? availHeight) - pad.top - pad.bottom

    const content = positionChildren(
        node.children, styles, boxes,
        x + pad.left, y + pad.top, innerW, innerH,
        style?.flexDirection ?? 'column', style?.gap ?? 0,
        style?.justifyContent ?? 'start', style?.alignItems ?? 'start',
    )

    const finalWidth = constrain(nodeWidth ?? (content.width + pad.left + pad.right), style?.minWidth, style?.maxWidth)
    const finalHeight = constrain(nodeHeight ?? (content.height + pad.top + pad.bottom), style?.minHeight, style?.maxHeight)

    boxes.set(node.id, { x, y, width: finalWidth, height: finalHeight })
    return { width: finalWidth, height: finalHeight }
}

function positionChildren(
    children: TermNode[], styles: Map<number, ResolvedStyle>, boxes: Map<number, LayoutBox>,
    innerX: number, innerY: number, innerW: number, innerH: number,
    dir: 'row' | 'column', gap: number,
    justify: ResolvedStyle['justifyContent'], align: ResolvedStyle['alignItems'],
): { width: number; height: number } {
    const visible = children.filter(c => c.nodeType !== 'comment' && styles.get(c.id)?.display !== 'none')
    if (visible.length === 0) return { width: 0, height: 0 }

    // Measure
    const sizes = visible.map(child => layoutNode(child, styles, boxes, 0, 0, innerW, innerH))
    const growValues = visible.map(child => styles.get(child.id)?.flexGrow ?? 0)
    const totalGrow = growValues.reduce((a, b) => a + b, 0)

    const totalMain = sizes.reduce((sum, s, i) => {
        return sum + (dir === 'row' ? s.width : s.height) + (i > 0 ? gap : 0)
    }, 0)

    const availMain = dir === 'row' ? innerW : innerH
    const freeSpace = Math.max(0, availMain - totalMain)
    const hasGrow = totalGrow > 0

    // Position
    let mainPos = computeMainStart(justify, freeSpace, visible.length, hasGrow)
    const itemGap = computeItemGap(justify, gap, freeSpace, visible.length, hasGrow)

    let contentWidth = 0
    let contentHeight = 0

    for (let i = 0; i < visible.length; i++) {
        let mainSize = dir === 'row' ? sizes[i].width : sizes[i].height
        if (hasGrow && growValues[i] > 0) {
            mainSize += Math.floor(freeSpace * growValues[i] / totalGrow)
        }

        const crossSize = dir === 'row' ? sizes[i].height : sizes[i].width
        const crossAvail = dir === 'row' ? innerH : innerW
        const crossOffset = computeCrossOffset(align, crossAvail, crossSize)

        const cx = dir === 'row' ? innerX + mainPos : innerX + crossOffset
        const cy = dir === 'column' ? innerY + mainPos : innerY + crossOffset

        layoutNode(visible[i], styles, boxes, cx, cy, mainSize, dir === 'row' ? innerH : mainSize)

        mainPos += mainSize + (i < visible.length - 1 ? itemGap : 0)
        contentWidth = dir === 'row' ? mainPos : Math.max(contentWidth, sizes[i].width)
        contentHeight = dir === 'column' ? mainPos : Math.max(contentHeight, sizes[i].height)
    }

    return { width: contentWidth, height: contentHeight }
}
