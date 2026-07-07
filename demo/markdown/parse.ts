/**
 * Minimal markdown block parser for the viewer demo: headings (1-3),
 * paragraphs, fenced code, flat lists, quotes, and rules. Inline
 * formatting arrives in a later slice; block text stays raw here.
 */

export type Block =
    | { type: 'heading'; level: 1 | 2 | 3; text: string }
    | { type: 'para'; text: string }
    | { type: 'code'; lang: string; lines: string[] }
    | { type: 'list'; ordered: boolean; items: string[] }
    | { type: 'quote'; text: string }
    | { type: 'hr' }

const HEADING = /^(#{1,3})\s+(.*)$/
const FENCE = /^```(\S*)\s*$/
const UNORDERED = /^[-*]\s+(.*)$/
const ORDERED = /^\d+\.\s+(.*)$/
const RULE = /^(-{3,}|\*{3,})\s*$/

export function parseMarkdown(source: string): Block[] {
    const lines = source.split('\n')
    const blocks: Block[] = []
    let i = 0

    while (i < lines.length) {
        const line = lines[i]

        if (line.trim() === '') { i++; continue }

        const fence = FENCE.exec(line)
        if (fence) {
            i = readCodeBlock(lines, i + 1, fence[1], blocks)
            continue
        }

        const heading = HEADING.exec(line)
        if (heading) {
            blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] })
            i++
            continue
        }

        if (RULE.test(line)) {
            blocks.push({ type: 'hr' })
            i++
            continue
        }

        if (UNORDERED.test(line) || ORDERED.test(line)) {
            i = readList(lines, i, blocks)
            continue
        }

        if (line.startsWith('> ')) {
            i = readWhile(lines, i, l => l.startsWith('> '),
                text => blocks.push({ type: 'quote', text }), l => l.substring(2))
            continue
        }

        i = readWhile(lines, i, l => isParagraphLine(l),
            text => blocks.push({ type: 'para', text }), l => l)
    }

    return blocks
}

function isParagraphLine(line: string): boolean {
    return line.trim() !== '' && !HEADING.test(line) && !FENCE.test(line)
        && !RULE.test(line) && !UNORDERED.test(line) && !ORDERED.test(line)
        && !line.startsWith('> ')
}

/** Collect lines matching `take`, join with spaces, and emit one block. */
function readWhile(
    lines: string[], from: number,
    take: (line: string) => boolean,
    emit: (text: string) => void,
    strip: (line: string) => string,
): number {
    let i = from
    const collected: string[] = []
    while (i < lines.length && take(lines[i])) {
        collected.push(strip(lines[i]).trim())
        i++
    }
    emit(collected.join(' '))
    return i
}

function readCodeBlock(lines: string[], from: number, lang: string, blocks: Block[]): number {
    let i = from
    const code: string[] = []
    while (i < lines.length && !FENCE.test(lines[i])) {
        code.push(lines[i])
        i++
    }
    // Drop the artefact of splitting a trailing newline on an open fence
    if (i === lines.length && code[code.length - 1] === '') code.pop()
    blocks.push({ type: 'code', lang, lines: code })
    return i + 1 // skip the closing fence (or run off the end)
}

function readList(lines: string[], from: number, blocks: Block[]): number {
    const ordered = ORDERED.test(lines[from])
    let i = from
    const items: string[] = []
    while (i < lines.length) {
        const item = (ordered ? ORDERED : UNORDERED).exec(lines[i])
        if (!item) break
        items.push(item[1].trim())
        i++
    }
    blocks.push({ type: 'list', ordered, items })
    return i
}
