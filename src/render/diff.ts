import { Cell, CellBuffer, cellsEqual } from './buffer.js'
import * as ansi from './ansi.js'

export function diffBuffers(prev: CellBuffer | null, next: CellBuffer): string {
    const parts: string[] = []
    let lastStyle: string | null = null

    for (let row = 0; row < next.height; row++) {
        for (let col = 0; col < next.width; col++) {
            const cell = next.getCell(col, row)!
            const prevCell = prev?.getCell(col, row)

            if (prevCell && cellsEqual(prevCell, cell)) continue

            parts.push(ansi.moveTo(col + 1, row + 1))

            const styleCode = buildStyleCode(cell)
            if (styleCode !== lastStyle) {
                parts.push(ansi.resetStyle())
                parts.push(styleCode)
                lastStyle = styleCode
            }

            parts.push(cell.char)
        }
    }

    if (parts.length > 0) {
        parts.push(ansi.resetStyle())
    }

    return parts.join('')
}

function buildStyleCode(cell: Cell): string {
    const parts: string[] = []
    if (cell.fg !== 'default') parts.push(ansi.fgColor(cell.fg))
    if (cell.bg !== 'default') parts.push(ansi.bgColor(cell.bg))
    if (cell.bold) parts.push(ansi.bold())
    if (cell.dim) parts.push(ansi.dim())
    if (cell.italic) parts.push(ansi.italic())
    if (cell.underline) parts.push(ansi.underline())
    if (cell.strikethrough) parts.push(ansi.strikethrough())
    return parts.join('')
}
