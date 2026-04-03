import { Cell, CellBuffer } from './buffer.js'

/**
 * Serialize a cell buffer to a readable text format for snapshot testing.
 * Each line shows the characters, followed by color/style annotations for non-default cells.
 */
export function bufferToText(buffer: CellBuffer): string {
    const lines: string[] = []

    for (let row = 0; row < buffer.height; row++) {
        let line = ''
        let hasContent = false

        for (let col = 0; col < buffer.width; col++) {
            const cell = buffer.getCell(col, row)!
            line += cell.char
            if (cell.char !== ' ' || cell.bg !== 'default') hasContent = true
        }

        if (hasContent) {
            lines.push(line.trimEnd())
        } else if (lines.length > 0) {
            // Track empty lines between content, but trim trailing empties
            lines.push('')
        }
    }

    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop()
    }

    return lines.join('\n')
}

/**
 * Serialize a cell buffer to a detailed format that includes style info.
 * Format: each non-default cell shows [col,row char fg bg bold]
 */
export function bufferToStyledText(buffer: CellBuffer): string {
    const lines: string[] = []

    for (let row = 0; row < buffer.height; row++) {
        let chars = ''
        const styles: string[] = []

        for (let col = 0; col < buffer.width; col++) {
            const cell = buffer.getCell(col, row)!
            chars += cell.char

            if (hasStyle(cell)) {
                const parts: string[] = []
                if (cell.fg !== 'default') parts.push(`fg:${cell.fg}`)
                if (cell.bg !== 'default') parts.push(`bg:${cell.bg}`)
                if (cell.bold) parts.push('bold')
                if (cell.italic) parts.push('italic')
                if (cell.underline) parts.push('underline')
                if (cell.dim) parts.push('dim')
                styles.push(`[${col}:${parts.join(',')}]`)
            }
        }

        const trimmed = chars.trimEnd()
        if (trimmed || styles.length > 0) {
            const line = styles.length > 0
                ? `${trimmed} ${styles.join(' ')}`
                : trimmed
            lines.push(line)
        }
    }

    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop()
    }

    return lines.join('\n')
}

/**
 * Render a cell buffer to SVG for visual inspection.
 */
export function bufferToSvg(buffer: CellBuffer, options?: { cellWidth?: number; cellHeight?: number }): string {
    const cw = options?.cellWidth ?? 10
    const ch = options?.cellHeight ?? 18
    const fontSize = Math.floor(ch * 0.75)
    const width = buffer.width * cw
    const height = buffer.height * ch

    const parts: string[] = []
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:#1a1a2e">`)
    parts.push(`<style>text { font-family: 'Menlo', 'Monaco', 'Courier New', monospace; font-size: ${fontSize}px; }</style>`)

    for (let row = 0; row < buffer.height; row++) {
        for (let col = 0; col < buffer.width; col++) {
            const cell = buffer.getCell(col, row)!
            const x = col * cw
            const y = row * ch

            // Background
            if (cell.bg !== 'default') {
                const bgColor = colorToHex(cell.bg)
                parts.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${bgColor}"/>`)
            }

            // Text
            if (cell.char !== ' ') {
                const fgColor = colorToHex(cell.fg === 'default' ? 'white' : cell.fg)
                const weight = cell.bold ? 'font-weight="bold"' : ''
                const decoration = cell.underline ? 'text-decoration="underline"' : ''
                const fontStyle = cell.italic ? 'font-style="italic"' : ''
                const textY = y + ch - Math.floor(ch * 0.25)
                parts.push(`<text x="${x + 1}" y="${textY}" fill="${fgColor}" ${weight} ${decoration} ${fontStyle}>${escapeXml(cell.char)}</text>`)
            }
        }
    }

    parts.push('</svg>')
    return parts.join('\n')
}

function hasStyle(cell: Cell): boolean {
    return cell.fg !== 'default' || cell.bg !== 'default'
        || cell.bold || cell.italic || cell.underline
        || cell.strikethrough || cell.dim
}

function colorToHex(color: string): string {
    if (color.startsWith('#')) return color
    const map: Record<string, string> = {
        black: '#000000', red: '#ff0000', green: '#00ff00', yellow: '#ffff00',
        blue: '#0000ff', magenta: '#ff00ff', cyan: '#00ffff', white: '#ffffff',
        default: '#cccccc',
    }
    return map[color] ?? '#cccccc'
}

function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
