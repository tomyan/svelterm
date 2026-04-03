import { TermNode } from '../renderer/node.js'

export interface ParsedSelector {
    tag?: string
    classes: string[]
    pseudo?: string
}

export function parseSelector(selector: string): ParsedSelector {
    const result: ParsedSelector = { classes: [] }
    let pos = 0

    // Parse tag name (if starts with a letter)
    if (pos < selector.length && /[a-zA-Z]/.test(selector[pos])) {
        const start = pos
        while (pos < selector.length && /[a-zA-Z0-9-]/.test(selector[pos])) pos++
        result.tag = selector.substring(start, pos)
    }

    // Parse classes and pseudo-classes
    while (pos < selector.length) {
        if (selector[pos] === '.') {
            pos++
            const start = pos
            while (pos < selector.length && /[a-zA-Z0-9_-]/.test(selector[pos])) pos++
            result.classes.push(selector.substring(start, pos))
        } else if (selector[pos] === ':') {
            pos++
            const start = pos
            while (pos < selector.length && /[a-zA-Z0-9_-]/.test(selector[pos])) pos++
            result.pseudo = selector.substring(start, pos)
        } else {
            pos++
        }
    }

    return result
}

export function matchesSelector(node: TermNode, selector: string): boolean {
    if (node.nodeType !== 'element') return false

    const trimmed = selector.trim()

    // :root matches the root element (no parent)
    if (trimmed === ':root') return node.parent === null

    const parsed = parseSelector(trimmed)

    if (parsed.tag && node.tag !== parsed.tag) return false

    const nodeClasses = node.classes
    for (const cls of parsed.classes) {
        if (!nodeClasses.has(cls)) return false
    }

    // Pseudo-class matching (basic :focus support)
    if (parsed.pseudo) {
        if (parsed.pseudo === 'focus') {
            return node.attributes.get('data-focused') === 'true'
        }
        return false
    }

    return true
}
