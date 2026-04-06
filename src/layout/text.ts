export function wrapText(text: string, width: number): string[] {
    if (text === '') return ['']
    if (text.length <= width) return [text]

    const lines: string[] = []
    let remaining = text

    while (remaining.length > 0) {
        if (remaining.length <= width) {
            lines.push(remaining)
            break
        }

        // Find last space within width
        let breakAt = remaining.lastIndexOf(' ', width)
        if (breakAt <= 0) {
            // No space found — hard break at width
            breakAt = width
            lines.push(remaining.substring(0, breakAt))
            remaining = remaining.substring(breakAt)
        } else {
            lines.push(remaining.substring(0, breakAt))
            remaining = remaining.substring(breakAt + 1) // skip the space
        }
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

export function measureText(text: string, availWidth: number): { width: number; height: number } {
    const lines = wrapText(text, availWidth)
    const maxLineWidth = lines.reduce((max, line) => Math.max(max, line.length), 0)
    return { width: maxLineWidth, height: lines.length }
}
