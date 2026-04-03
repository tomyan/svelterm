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
}

const BORDER_SETS: Record<string, BorderChars> = {
    single: { topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘', horizontal: '─', vertical: '│' },
    double: { topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝', horizontal: '═', vertical: '║' },
    rounded: { topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯', horizontal: '─', vertical: '│' },
    heavy: { topLeft: '┏', topRight: '┓', bottomLeft: '┗', bottomRight: '┛', horizontal: '━', vertical: '┃' },
}

export function renderBorder(buffer: CellBuffer, box: LayoutBox, style: ResolvedStyle): void {
    if (style.borderStyle === 'none') return

    const chars = BORDER_SETS[style.borderStyle]
    if (!chars) return

    const fg = style.borderColor !== 'default' ? style.borderColor : undefined
    const { x, y, width, height } = box
    const top = style.borderTop
    const right = style.borderRight
    const bottom = style.borderBottom
    const left = style.borderLeft

    // Corners (only where two adjacent sides meet)
    if (top && left) buffer.setCell(x, y, { char: chars.topLeft, fg })
    if (top && right) buffer.setCell(x + width - 1, y, { char: chars.topRight, fg })
    if (bottom && left) buffer.setCell(x, y + height - 1, { char: chars.bottomLeft, fg })
    if (bottom && right) buffer.setCell(x + width - 1, y + height - 1, { char: chars.bottomRight, fg })

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
