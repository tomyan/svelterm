import { CellBuffer } from './buffer.js'
import { LayoutBox } from '../layout/engine.js'
import { ResolvedStyle } from '../css/compute.js'

interface BorderChars {
    topLeft: string
    topRight: string
    bottomLeft: string
    bottomRight: string
    horizontal: string
    vertical: string
    teeLeft: string    // ├ — left T-junction (vertical with right branch)
    teeRight: string   // ┤ — right T-junction (vertical with left branch)
    teeTop: string     // ┬ — top T-junction (horizontal with bottom branch)
    teeBottom: string  // ┴ — bottom T-junction (horizontal with top branch)
    cross: string      // ┼ — 4-way cross junction
}

const BORDER_SETS: Record<string, BorderChars> = {
    single:  { topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘', horizontal: '─', vertical: '│', teeLeft: '├', teeRight: '┤', teeTop: '┬', teeBottom: '┴', cross: '┼' },
    double:  { topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝', horizontal: '═', vertical: '║', teeLeft: '╠', teeRight: '╣', teeTop: '╦', teeBottom: '╩', cross: '╬' },
    rounded: { topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯', horizontal: '─', vertical: '│', teeLeft: '├', teeRight: '┤', teeTop: '┬', teeBottom: '┴', cross: '┼' },
    heavy:   { topLeft: '┏', topRight: '┓', bottomLeft: '┗', bottomRight: '┛', horizontal: '━', vertical: '┃', teeLeft: '┣', teeRight: '┫', teeTop: '┳', teeBottom: '┻', cross: '╋' },
}

/** Sets of border characters for collapse detection */
const BOTTOM_LEFT_CORNERS = new Set(Object.values(BORDER_SETS).map(s => s.bottomLeft))
const BOTTOM_RIGHT_CORNERS = new Set(Object.values(BORDER_SETS).map(s => s.bottomRight))
const TOP_LEFT_CORNERS = new Set(Object.values(BORDER_SETS).map(s => s.topLeft))
const TOP_RIGHT_CORNERS = new Set(Object.values(BORDER_SETS).map(s => s.topRight))
const TEE_BOTTOM_CHARS = new Set(Object.values(BORDER_SETS).map(s => s.teeBottom))
const TEE_TOP_CHARS = new Set(Object.values(BORDER_SETS).map(s => s.teeTop))
const TEE_LEFT_CHARS = new Set(Object.values(BORDER_SETS).map(s => s.teeLeft))
const TEE_RIGHT_CHARS = new Set(Object.values(BORDER_SETS).map(s => s.teeRight))
const CROSS_CHARS = new Set(Object.values(BORDER_SETS).map(s => s.cross))

/**
 * Merge a corner character with whatever is already in the buffer cell.
 * If the existing character is an opposite corner, produce a T-junction.
 * If it's already a T-junction (from a previous merge), produce a cross.
 */
function mergeCorner(
    buffer: CellBuffer, cx: number, cy: number,
    defaultChar: string, chars: BorderChars,
    corner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight',
): string {
    const existing = buffer.getCell(cx, cy)?.char
    if (!existing) return defaultChar
    // An existing cross already connects all four directions — preserve it
    if (CROSS_CHARS.has(existing)) return chars.cross

    switch (corner) {
        case 'topLeft':
            if (BOTTOM_LEFT_CORNERS.has(existing) || TEE_LEFT_CHARS.has(existing)) return chars.teeLeft
            if (TOP_RIGHT_CORNERS.has(existing) || TEE_TOP_CHARS.has(existing)) return chars.teeTop
            if (BOTTOM_RIGHT_CORNERS.has(existing) || TEE_RIGHT_CHARS.has(existing) || TEE_BOTTOM_CHARS.has(existing)) return chars.cross
            return defaultChar
        case 'topRight':
            if (BOTTOM_RIGHT_CORNERS.has(existing) || TEE_RIGHT_CHARS.has(existing)) return chars.teeRight
            if (TOP_LEFT_CORNERS.has(existing) || TEE_TOP_CHARS.has(existing)) return chars.teeTop
            if (BOTTOM_LEFT_CORNERS.has(existing) || TEE_LEFT_CHARS.has(existing) || TEE_BOTTOM_CHARS.has(existing)) return chars.cross
            return defaultChar
        case 'bottomLeft':
            if (TOP_LEFT_CORNERS.has(existing) || TEE_LEFT_CHARS.has(existing)) return chars.teeLeft
            if (BOTTOM_RIGHT_CORNERS.has(existing) || TEE_BOTTOM_CHARS.has(existing)) return chars.teeBottom
            if (TOP_RIGHT_CORNERS.has(existing) || TEE_RIGHT_CHARS.has(existing) || TEE_TOP_CHARS.has(existing)) return chars.cross
            return defaultChar
        case 'bottomRight':
            if (TOP_RIGHT_CORNERS.has(existing) || TEE_RIGHT_CHARS.has(existing)) return chars.teeRight
            if (BOTTOM_LEFT_CORNERS.has(existing) || TEE_BOTTOM_CHARS.has(existing)) return chars.teeBottom
            if (TOP_LEFT_CORNERS.has(existing) || TEE_LEFT_CHARS.has(existing) || TEE_TOP_CHARS.has(existing)) return chars.cross
            return defaultChar
    }
}

interface BlockEdges {
    top: string
    bottom: string
    left: string
    right: string
}

const BLOCK_EDGES: Record<string, BlockEdges> = {
    'eighth-cell-inner': { top: '\u2581', bottom: '\u2594', left: '\u2595', right: '\u258F' },
    'eighth-cell-outer': { top: '\u2594', bottom: '\u2581', left: '\u258F', right: '\u2595' },
    'half-cell-inner':   { top: '\u2584', bottom: '\u2580', left: '\u2590', right: '\u258C' },
    'half-cell-outer':   { top: '\u2580', bottom: '\u2584', left: '\u258C', right: '\u2590' },
    'full-cell':         { top: '\u2588', bottom: '\u2588', left: '\u2588', right: '\u2588' },
}

export function renderBorder(buffer: CellBuffer, box: LayoutBox, style: ResolvedStyle): void {
    if (style.borderStyle === 'none') return

    const blockEdges = BLOCK_EDGES[style.borderStyle]
    if (blockEdges) {
        renderBlockBorder(buffer, box, style, blockEdges)
        return
    }

    const chars = BORDER_SETS[style.borderStyle]
    if (!chars) return

    const fg = style.borderColor !== 'default' ? style.borderColor : undefined
    const { x, y, width, height } = box
    const top = style.borderTop
    const right = style.borderRight
    const bottom = style.borderBottom
    const left = style.borderLeft

    // Corners — merge into T-junctions or crosses when overlapping a sibling's border
    if (top && left) {
        const char = mergeCorner(buffer, x, y, chars.topLeft, chars, 'topLeft')
        buffer.setCell(x, y, { char, fg })
    }
    if (top && right) {
        const char = mergeCorner(buffer, x + width - 1, y, chars.topRight, chars, 'topRight')
        buffer.setCell(x + width - 1, y, { char, fg })
    }
    if (bottom && left) {
        const char = mergeCorner(buffer, x, y + height - 1, chars.bottomLeft, chars, 'bottomLeft')
        buffer.setCell(x, y + height - 1, { char, fg })
    }
    if (bottom && right) {
        const char = mergeCorner(buffer, x + width - 1, y + height - 1, chars.bottomRight, chars, 'bottomRight')
        buffer.setCell(x + width - 1, y + height - 1, { char, fg })
    }

    // Top edge
    if (top) {
        const startCol = left ? x + 1 : x
        const endCol = right ? x + width - 1 : x + width
        for (let col = startCol; col < endCol; col++) {
            buffer.setCell(col, y, { char: chars.horizontal, fg })
        }
    }

    // Bottom edge
    if (bottom) {
        const startCol = left ? x + 1 : x
        const endCol = right ? x + width - 1 : x + width
        for (let col = startCol; col < endCol; col++) {
            buffer.setCell(col, y + height - 1, { char: chars.horizontal, fg })
        }
    }

    // Left edge
    if (left) {
        const startRow = top ? y + 1 : y
        const endRow = bottom ? y + height - 1 : y + height
        for (let row = startRow; row < endRow; row++) {
            buffer.setCell(x, row, { char: chars.vertical, fg })
        }
    }

    // Right edge
    if (right) {
        const startRow = top ? y + 1 : y
        const endRow = bottom ? y + height - 1 : y + height
        for (let row = startRow; row < endRow; row++) {
            buffer.setCell(x + width - 1, row, { char: chars.vertical, fg })
        }
    }
}

/**
 * Render a block-character border (eighth-cell-*, half-cell-*, full-cell).
 * Corner cells are owned by the axis selected via border-corner: 'h' (default top/bottom),
 * 'v' (sides), or 'none' (corners blank).
 */
function renderBlockBorder(
    buffer: CellBuffer, box: LayoutBox, style: ResolvedStyle, edges: BlockEdges,
): void {
    const fg = style.borderColor !== 'default' ? style.borderColor : undefined
    const { x, y, width, height } = box
    const top = style.borderTop
    const right = style.borderRight
    const bottom = style.borderBottom
    const left = style.borderLeft
    const corner = style.borderCorner

    // Corner ownership controls how far horizontal vs vertical edges extend.
    // 'h' = top/bottom strokes extend through the full row, sides indent by 1
    // 'v' = sides extend through the full column, top/bottom indent by 1
    // 'none' = corners blank, both axes indent by 1
    const hOwnsCorners = corner === 'h'
    const vOwnsCorners = corner === 'v'

    const horizStart = (left && !hOwnsCorners) ? x + 1 : x
    const horizEnd = (right && !hOwnsCorners) ? x + width - 1 : x + width
    const vertStart = (top && !vOwnsCorners) ? y + 1 : y
    const vertEnd = (bottom && !vOwnsCorners) ? y + height - 1 : y + height

    if (top) {
        for (let col = horizStart; col < horizEnd; col++) {
            buffer.setCell(col, y, { char: edges.top, fg })
        }
    }
    if (bottom) {
        for (let col = horizStart; col < horizEnd; col++) {
            buffer.setCell(col, y + height - 1, { char: edges.bottom, fg })
        }
    }
    if (left) {
        for (let row = vertStart; row < vertEnd; row++) {
            buffer.setCell(x, row, { char: edges.left, fg })
        }
    }
    if (right) {
        for (let row = vertStart; row < vertEnd; row++) {
            buffer.setCell(x + width - 1, row, { char: edges.right, fg })
        }
    }
}
