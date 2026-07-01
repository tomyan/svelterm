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
    ascii:   { topLeft: '+', topRight: '+', bottomLeft: '+', bottomRight: '+', horizontal: '-', vertical: '|', teeLeft: '+', teeRight: '+', teeTop: '+', teeBottom: '+', cross: '+' },
}

/**
 * Direction masks for box-drawing glyph merging. Each glyph is the set of
 * directions its strokes point in; overlapping glyphs merge by unioning
 * their masks (e.g. ┐ over └ → all four directions → ┼).
 */
const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8

const GLYPH_MASKS: Record<string, number> = {}
for (const s of Object.values(BORDER_SETS)) {
    GLYPH_MASKS[s.topLeft] = RIGHT | DOWN
    GLYPH_MASKS[s.topRight] = LEFT | DOWN
    GLYPH_MASKS[s.bottomLeft] = UP | RIGHT
    GLYPH_MASKS[s.bottomRight] = UP | LEFT
    GLYPH_MASKS[s.horizontal] = LEFT | RIGHT
    GLYPH_MASKS[s.vertical] = UP | DOWN
    GLYPH_MASKS[s.teeLeft] = UP | DOWN | RIGHT
    GLYPH_MASKS[s.teeRight] = UP | DOWN | LEFT
    GLYPH_MASKS[s.teeTop] = LEFT | RIGHT | DOWN
    GLYPH_MASKS[s.teeBottom] = LEFT | RIGHT | UP
    GLYPH_MASKS[s.cross] = UP | RIGHT | DOWN | LEFT
}

function glyphForMask(chars: BorderChars, mask: number): string | undefined {
    switch (mask) {
        case RIGHT | DOWN: return chars.topLeft
        case LEFT | DOWN: return chars.topRight
        case UP | RIGHT: return chars.bottomLeft
        case UP | LEFT: return chars.bottomRight
        case LEFT | RIGHT: return chars.horizontal
        case UP | DOWN: return chars.vertical
        case UP | DOWN | RIGHT: return chars.teeLeft
        case UP | DOWN | LEFT: return chars.teeRight
        case LEFT | RIGHT | DOWN: return chars.teeTop
        case LEFT | RIGHT | UP: return chars.teeBottom
        case UP | RIGHT | DOWN | LEFT: return chars.cross
        default: return undefined
    }
}

/**
 * Merge a border glyph with whatever box-drawing character is already in the
 * buffer cell, producing T-junctions and crosses where strokes meet. The new
 * glyph's family (single/double/...) wins for the merged character.
 */
function mergeGlyph(
    buffer: CellBuffer, cx: number, cy: number,
    newMask: number, chars: BorderChars,
): string {
    const fallback = glyphForMask(chars, newMask) ?? chars.cross
    const existing = buffer.getCell(cx, cy)?.char
    const existingMask = existing !== undefined ? GLYPH_MASKS[existing] : undefined
    if (existingMask === undefined) return fallback
    return glyphForMask(chars, existingMask | newMask) ?? fallback
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

/**
 * Quadrant glyphs used as corner pieces for half-cell borders. Each combines
 * the stroke of two adjacent half-cell edges into a single cell. Eighth-cell
 * borders have no equivalent corner glyph (no 1/8-thick L shape in Block
 * Elements) so they fall back to border-corner: h|v|none.
 */
interface BlockCorners {
    topLeft: string
    topRight: string
    bottomLeft: string
    bottomRight: string
}
const BLOCK_CORNERS: Record<string, BlockCorners> = {
    // Inner-facing: strokes face the content area, so corner glyphs fill the
    // inner quadrant relative to the cell (e.g. top-left corner fills lower-right).
    'half-cell-inner': {
        topLeft:     '\u2597',  // ▗ lower-right quadrant
        topRight:    '\u2596',  // ▖ lower-left quadrant
        bottomLeft:  '\u259D',  // ▝ upper-right quadrant
        bottomRight: '\u2598',  // ▘ upper-left quadrant
    },
    // Outer-facing: strokes face outward. Corner cells combine the full upper
    // half (or lower half) with the full left half (or right half), forming
    // three-quadrant L glyphs with just the diagonally-inner quadrant empty.
    'half-cell-outer': {
        topLeft:     '\u259B',  // ▛ TL+TR+BL (missing BR)
        topRight:    '\u259C',  // ▜ TL+TR+BR (missing BL)
        bottomLeft:  '\u2599',  // ▙ TL+BL+BR (missing TR)
        bottomRight: '\u259F',  // ▟ TR+BL+BR (missing TL)
    },
    'full-cell': {
        topLeft: '\u2588', topRight: '\u2588', bottomLeft: '\u2588', bottomRight: '\u2588',
    },
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
        buffer.setCell(x, y, { char: mergeGlyph(buffer, x, y, RIGHT | DOWN, chars), fg })
    }
    if (top && right) {
        buffer.setCell(x + width - 1, y, { char: mergeGlyph(buffer, x + width - 1, y, LEFT | DOWN, chars), fg })
    }
    if (bottom && left) {
        buffer.setCell(x, y + height - 1, { char: mergeGlyph(buffer, x, y + height - 1, UP | RIGHT, chars), fg })
    }
    if (bottom && right) {
        buffer.setCell(x + width - 1, y + height - 1, { char: mergeGlyph(buffer, x + width - 1, y + height - 1, UP | LEFT, chars), fg })
    }

    // Top edge
    if (top) {
        const startCol = left ? x + 1 : x
        const endCol = right ? x + width - 1 : x + width
        for (let col = startCol; col < endCol; col++) {
            buffer.setCell(col, y, { char: mergeGlyph(buffer, col, y, LEFT | RIGHT, chars), fg })
        }
    }

    // Bottom edge
    if (bottom) {
        const startCol = left ? x + 1 : x
        const endCol = right ? x + width - 1 : x + width
        for (let col = startCol; col < endCol; col++) {
            buffer.setCell(col, y + height - 1, { char: mergeGlyph(buffer, col, y + height - 1, LEFT | RIGHT, chars), fg })
        }
    }

    // Left edge
    if (left) {
        const startRow = top ? y + 1 : y
        const endRow = bottom ? y + height - 1 : y + height
        for (let row = startRow; row < endRow; row++) {
            buffer.setCell(x, row, { char: mergeGlyph(buffer, x, row, UP | DOWN, chars), fg })
        }
    }

    // Right edge
    if (right) {
        const startRow = top ? y + 1 : y
        const endRow = bottom ? y + height - 1 : y + height
        for (let row = startRow; row < endRow; row++) {
            buffer.setCell(x + width - 1, row, { char: mergeGlyph(buffer, x + width - 1, row, UP | DOWN, chars), fg })
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
    // 'none' = corners blank (or filled by dedicated corner glyphs, if available)
    //
    // eighth-cell-outer defaults to 'h' when 'none' is specified — there's no
    // corner glyph in Block Elements for 1/8-thick L pieces, and with no
    // extension the corners would be visibly missing from the outer frame.
    const effectiveCorner = (corner === 'none' && style.borderStyle === 'eighth-cell-outer') ? 'h' : corner
    const hOwnsCorners = effectiveCorner === 'h'
    const vOwnsCorners = effectiveCorner === 'v'
    const corners = (effectiveCorner === 'none') ? BLOCK_CORNERS[style.borderStyle] : undefined

    const horizStart = (left && !hOwnsCorners) ? x + 1 : x
    const horizEnd = (right && !hOwnsCorners) ? x + width - 1 : x + width
    const vertStart = (top && !vOwnsCorners) ? y + 1 : y
    const vertEnd = (bottom && !vOwnsCorners) ? y + height - 1 : y + height

    // Place corner glyphs first so edge-paint loops don't overwrite them.
    if (corners) {
        if (top && left)    buffer.setCell(x, y, { char: corners.topLeft, fg })
        if (top && right)   buffer.setCell(x + width - 1, y, { char: corners.topRight, fg })
        if (bottom && left) buffer.setCell(x, y + height - 1, { char: corners.bottomLeft, fg })
        if (bottom && right) buffer.setCell(x + width - 1, y + height - 1, { char: corners.bottomRight, fg })
    }

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
