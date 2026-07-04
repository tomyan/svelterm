/**
 * Minimal terminal-screen model for round-trip tests: feed it the ANSI
 * svelterm emits and compare the resulting grid against the CellBuffer
 * that produced it. Supports what our emitters use: CUP, CUU/CUD, CHA,
 * CR/LF, ED, SGR (named/256/truecolor, attributes), wide glyphs.
 */

export interface ScreenCell {
    char: string
    fg: string
    bg: string
    bold: boolean
    inverse: boolean
}

const SGR_NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

export class AnsiScreen {
    private grid: ScreenCell[][]
    private row = 0
    private col = 0
    private fg = 'default'
    private bg = 'default'
    private bold = false
    private inverse = false

    constructor(public cols: number, public rows: number) {
        this.grid = Array.from({ length: rows }, () => Array.from({ length: cols }, blank))
    }

    cell(col: number, row: number): ScreenCell {
        return this.grid[row]?.[col] ?? blank()
    }

    rowText(row: number): string {
        return (this.grid[row] ?? []).map(c => c.char).join('').replace(/\s+$/, '')
    }

    text(): string {
        return this.grid.map((_, i) => this.rowText(i)).join('\n').replace(/\n+$/, '')
    }

    write(data: string): void {
        let rest = data
        while (rest.length > 0) {
            const esc = rest.indexOf('\x1b')
            const plain = esc === -1 ? rest : rest.slice(0, esc)
            for (const glyph of plain) this.writeChar(glyph)
            if (esc === -1) return
            rest = rest.slice(esc)
            const consumed = this.handleEscape(rest)
            rest = rest.slice(consumed)
        }
    }

    private writeChar(char: string): void {
        if (char === '\r') { this.col = 0; return }
        if (char === '\n') { this.row = Math.min(this.rows - 1, this.row + 1); return }
        const width = char.codePointAt(0)! > 0x2e7f ? 2 : 1
        this.put(this.col, this.row, char)
        if (width === 2) this.put(this.col + 1, this.row, '')
        this.col += width
    }

    private put(col: number, row: number, char: string): void {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return
        this.grid[row][col] = {
            char, fg: this.fg, bg: this.bg, bold: this.bold, inverse: this.inverse,
        }
    }

    /** Handle one escape sequence at the head of `data`; return its length. */
    private handleEscape(data: string): number {
        const csi = /^\x1b\[([0-9;?]*)([a-zA-Z])/.exec(data)
        if (!csi) return 1 // lone ESC or unsupported — skip the ESC byte
        const params = csi[1]
        const final = csi[2]
        const nums = params.replace('?', '').split(';').map(n => parseInt(n, 10))
        switch (final) {
            case 'H': {
                this.row = (nums[0] || 1) - 1
                this.col = (nums[1] || 1) - 1
                break
            }
            case 'A': this.row = Math.max(0, this.row - (nums[0] || 1)); break
            case 'B': this.row = Math.min(this.rows - 1, this.row + (nums[0] || 1)); break
            case 'G': this.col = (nums[0] || 1) - 1; break
            case 'J': this.eraseBelow(); break
            case 'm': this.applySgr(params); break
            default: break // modes (h/l), etc. — ignored
        }
        return csi[0].length
    }

    private eraseBelow(): void {
        for (let col = this.col; col < this.cols; col++) this.grid[this.row][col] = blank()
        for (let row = this.row + 1; row < this.rows; row++) {
            this.grid[row] = Array.from({ length: this.cols }, blank)
        }
    }

    private applySgr(params: string): void {
        const codes = params === '' ? [0] : params.split(';').map(n => parseInt(n, 10) || 0)
        for (let i = 0; i < codes.length; i++) {
            const code = codes[i]
            if (code === 0) { this.fg = 'default'; this.bg = 'default'; this.bold = false; this.inverse = false }
            else if (code === 1) this.bold = true
            else if (code === 7) this.inverse = true
            else if (code >= 30 && code <= 37) this.fg = SGR_NAMES[code - 30]
            else if (code === 39) this.fg = 'default'
            else if (code >= 40 && code <= 47) this.bg = SGR_NAMES[code - 40]
            else if (code === 49) this.bg = 'default'
            else if (code === 38 || code === 48) {
                const target = code === 38 ? 'fg' : 'bg'
                if (codes[i + 1] === 5) { this[target] = `palette:${codes[i + 2]}`; i += 2 }
                else if (codes[i + 1] === 2) {
                    this[target] = '#' + [codes[i + 2], codes[i + 3], codes[i + 4]]
                        .map(c => (c || 0).toString(16).padStart(2, '0')).join('')
                    i += 4
                }
            }
        }
    }
}

function blank(): ScreenCell {
    return { char: ' ', fg: 'default', bg: 'default', bold: false, inverse: false }
}
