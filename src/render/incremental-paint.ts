import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { ResolvedStyle } from '../css/compute.js'
import { LayoutBox } from '../layout/engine.js'
import { paint } from './paint.js'

/**
 * Repaint only the region affected by dirty nodes.
 *
 * Computes the union bounding box of all dirty nodes, clears that
 * region, then does a full repaint of the entire tree clipped to
 * that region. This correctly handles overlapping elements like
 * parent borders, list markers in padding areas, and z-indexed
 * siblings.
 */
export function paintNodes(
    nodes: Set<TermNode>,
    buffer: CellBuffer,
    styles: Map<number, ResolvedStyle>,
    layout: Map<number, LayoutBox>,
    root: TermNode,
): void {
    if (nodes.size === 0) return

    // Compute dirty region — union of all dirty nodes' current and previous boxes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const node of nodes) {
        const box = layout.get(node.id)
        if (box) {
            minX = Math.min(minX, box.x)
            minY = Math.min(minY, box.y)
            maxX = Math.max(maxX, box.x + box.width)
            maxY = Math.max(maxY, box.y + box.height)
        }
        const oldBox = node.cache.layoutBox
        if (oldBox) {
            minX = Math.min(minX, oldBox.x)
            minY = Math.min(minY, oldBox.y)
            maxX = Math.max(maxX, oldBox.x + oldBox.width)
            maxY = Math.max(maxY, oldBox.y + oldBox.height)
        }
    }

    if (minX >= maxX || minY >= maxY) return

    // Expand dirty region to include parent borders and list marker padding
    // that may overlap the dirty area
    for (const node of nodes) {
        let parent = node.parent
        while (parent) {
            const parentBox = layout.get(parent.id)
            if (parentBox) {
                minX = Math.min(minX, parentBox.x)
                minY = Math.min(minY, parentBox.y)
                maxX = Math.max(maxX, parentBox.x + parentBox.width)
                maxY = Math.max(maxY, parentBox.y + parentBox.height)
            }
            parent = parent.parent
        }
    }

    // Clamp to buffer bounds
    minX = Math.max(0, minX)
    minY = Math.max(0, minY)
    maxX = Math.min(buffer.width, maxX)
    maxY = Math.min(buffer.height, maxY)

    // Clear the dirty region
    for (let row = minY; row < maxY; row++) {
        for (let col = minX; col < maxX; col++) {
            buffer.setCell(col, row, {
                char: ' ', fg: 'default', bg: 'default',
                bold: false, italic: false, underline: false,
                strikethrough: false, dim: false,
            })
        }
    }

    // Full repaint of the entire tree, clipped to the dirty region
    const clip = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    paint(root, buffer, styles, layout, clip)
}
