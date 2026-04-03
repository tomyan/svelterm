export interface Cell {
    char: string
    fg: string
    bg: string
    bold: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
    dim: boolean
}

const EMPTY_CELL: Cell = {
    char: ' ', fg: 'default', bg: 'default',
    bold: false, italic: false, underline: false,
    strikethrough: false, dim: false,
}

export class CellBuffer {
    readonly width: number
    readonly height: number
    private cells: Cell[]

    constructor(width: number, height: number) {
        this.width = width
        this.height = height
        this.cells = new Array(width * height)
        this.clear()
    }

    clear(): void {
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i] = { ...EMPTY_CELL }
        }
    }

    getCell(col: number, row: number): Cell | undefined {
        if (col < 0 || col >= this.width || row < 0 || row >= this.height) return undefined
        return this.cells[row * this.width + col]
    }

    setCell(col: number, row: number, cell: Partial<Cell>): void {
        if (col < 0 || col >= this.width || row < 0 || row >= this.height) return
        const idx = row * this.width + col
        const existing = this.cells[idx]
        this.cells[idx] = {
            char: cell.char ?? existing.char,
            fg: cell.fg ?? existing.fg,
            bg: cell.bg ?? existing.bg,
            bold: cell.bold ?? existing.bold,
            italic: cell.italic ?? existing.italic,
            underline: cell.underline ?? existing.underline,
            strikethrough: cell.strikethrough ?? existing.strikethrough,
            dim: cell.dim ?? existing.dim,
        }
    }

    writeText(col: number, row: number, text: string, style?: Partial<Cell>): void {
        for (let i = 0; i < text.length; i++) {
            this.setCell(col + i, row, {
                char: text[i],
                fg: style?.fg,
                bg: style?.bg,
                bold: style?.bold,
                italic: style?.italic,
                underline: style?.underline,
                strikethrough: style?.strikethrough,
                dim: style?.dim,
            })
        }
    }
}

export function cellsEqual(a: Cell, b: Cell): boolean {
    return a.char === b.char && a.fg === b.fg && a.bg === b.bg
        && a.bold === b.bold && a.italic === b.italic
        && a.underline === b.underline && a.strikethrough === b.strikethrough
        && a.dim === b.dim
}
