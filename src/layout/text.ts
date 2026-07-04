export type WordBreak = 'normal' | 'break-all'

export function wrapText(text: string, width: number, wordBreak: WordBreak = 'normal'): string[] {
    if (text === '') return ['']
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
        // A break at a space boundary in break-all mode leaves a leading
        // space on the next line — trim it so lines stay flush.
        if (wordBreak === 'break-all') remaining = remaining.replace(/^ /, '')
    }

    return lines
}

export function truncateText(text: string, width: number): string {
    if (width <= 0) return ''
    if (text.length <= width) return text
    if (width === 1) return '…'
    return text.substring(0, width - 1) + '…'
}

export function truncateMiddle(text: string, width: number): string {
    if (width <= 0) return ''
    if (text.length <= width) return text
    if (width <= 3) return text.substring(0, width - 1) + '…'
    const half = Math.floor((width - 1) / 2)
    const endLen = width - 1 - half
    return text.substring(0, half) + '…' + text.substring(text.length - endLen)
}

export function measureText(text: string, availWidth: number, wordBreak: WordBreak = 'normal'): { width: number; height: number } {
    const lines = wrapText(text, availWidth, wordBreak)
    const maxLineWidth = lines.reduce((max, line) => Math.max(max, line.length), 0)
    return { width: maxLineWidth, height: lines.length }
}
