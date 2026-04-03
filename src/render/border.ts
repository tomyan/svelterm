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

    // Corners
    buffer.setCell(x, y, { char: chars.topLeft, fg })
    buffer.setCell(x + width - 1, y, { char: chars.topRight, fg })
    buffer.setCell(x, y + height - 1, { char: chars.bottomLeft, fg })
    buffer.setCell(x + width - 1, y + height - 1, { char: chars.bottomRight, fg })

    // Top and bottom edges
    for (let col = x + 1; col < x + width - 1; col++) {
        buffer.setCell(col, y, { char: chars.horizontal, fg })
        buffer.setCell(col, y + height - 1, { char: chars.horizontal, fg })
    }

    // Left and right edges
    for (let row = y + 1; row < y + height - 1; row++) {
        buffer.setCell(x, row, { char: chars.vertical, fg })
        buffer.setCell(x + width - 1, row, { char: chars.vertical, fg })
    }
}
