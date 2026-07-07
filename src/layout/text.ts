import { graphemes, charWidth, stringWidth } from './unicode.js'

export type WordBreak = 'normal' | 'break-all'

/** True when every unit is a single-cell ASCII character. */
function isPlainAscii(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) < 0x20 || text.charCodeAt(i) > 0x7e) return false
    }
    return true
}

export function wrapText(text: string, width: number, wordBreak: WordBreak = 'normal'): string[] {
    if (text === '') return ['']
    // Hard newlines (pre-formatted text, textarea values) always break;
    // each segment wraps independently.
    if (text.includes('\n')) {
        return text.split('\n').flatMap(segment => wrapText(segment, width, wordBreak))
    }
    if (isPlainAscii(text)) return wrapAscii(text, width, wordBreak)
    return wrapGraphemes(text, width, wordBreak)
}

function wrapAscii(text: string, width: number, wordBreak: WordBreak): string[] {
    if (text.length <= width) return [text]

    const lines: string[] = []
    let remaining = text

    while (remaining.length > 0) {
        if (remaining.length <= width) {
            lines.push(remaining)
            break
        }

        // break-all wraps at any character; normal prefers the last space
        const breakAt = wordBreak === 'break-all' ? -1 : remaining.lastIndexOf(' ', width)
        if (breakAt <= 0) {
            // Hard break at width (break-all, or no space found)
            lines.push(remaining.substring(0, width))
            remaining = remaining.substring(width)
        } else {
            lines.push(remaining.substring(0, breakAt))
            remaining = remaining.substring(breakAt + 1) // skip the space
        }
        if (wordBreak === 'break-all') remaining = remaining.replace(/^ /, '')
    }

    return lines
}

/** Wrap by cell width over grapheme clusters — wide glyphs never split. */
function wrapGraphemes(text: string, width: number, wordBreak: WordBreak): string[] {
    if (stringWidth(text) <= width) return [text]

    const cells = graphemes(text).map(g => ({ g, w: charWidth(g) }))
    const lines: string[] = []
    let line = ''
    let lineWidth = 0
    let lastSpaceIndex = -1 // index into `line` string of the last space

    for (const { g, w } of cells) {
        if (lineWidth + w > width && lineWidth > 0) {
            if (wordBreak === 'normal' && lastSpaceIndex > 0 && g !== ' ') {
                // Move the partial word down to the next line
                const carried = line.slice(lastSpaceIndex + 1)
                lines.push(line.slice(0, lastSpaceIndex))
                line = carried
                lineWidth = stringWidth(carried)
            } else {
                lines.push(line)
                line = ''
                lineWidth = 0
            }
            if (g === ' ') continue // breaks eat the space
        }
        line += g
        lineWidth += w
        if (g === ' ') lastSpaceIndex = line.length - 1
        else if (lastSpaceIndex >= line.length) lastSpaceIndex = -1
    }
    if (line !== '') lines.push(line)
    return lines
}

export function truncateText(text: string, width: number): string {
    if (width <= 0) return ''
    if (stringWidth(text) <= width) return text
    if (width === 1) return '…'
    let out = ''
    let used = 0
    for (const g of graphemes(text)) {
        const w = charWidth(g)
        if (used + w > width - 1) break
        out += g
        used += w
    }
    return out + '…'
}

export function truncateMiddle(text: string, width: number): string {
    if (width <= 0) return ''
    if (stringWidth(text) <= width) return text
    if (width <= 3) return truncateText(text, width)

    const cells = graphemes(text).map(g => ({ g, w: charWidth(g) }))
    const budget = width - 1
    const headBudget = Math.floor(budget / 2)

    let head = ''
    let used = 0
    for (const { g, w } of cells) {
        if (used + w > headBudget) break
        head += g
        used += w
    }

    const tailBudget = budget - used
    let tail = ''
    let tailUsed = 0
    for (let i = cells.length - 1; i >= 0; i--) {
        if (tailUsed + cells[i].w > tailBudget) break
        tail = cells[i].g + tail
        tailUsed += cells[i].w
    }
    return head + '…' + tail
}

export function measureText(text: string, availWidth: number, wordBreak: WordBreak = 'normal'): { width: number; height: number } {
    const lines = wrapText(text, availWidth, wordBreak)
    const maxLineWidth = lines.reduce((max, line) => Math.max(max, stringWidth(line)), 0)
    return { width: maxLineWidth, height: lines.length }
}
