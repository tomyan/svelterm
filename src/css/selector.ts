import { TermNode } from '../renderer/node.js'

export interface ParsedSelector {
    tag?: string
    id?: string
    classes: string[]
    pseudo?: string
}

interface SelectorPart {
    selector: ParsedSelector
    combinator: '' | '>' | ' '  // '' = rightmost (target), '>' = child, ' ' = descendant
}

export function parseSelector(selector: string): ParsedSelector {
    const result: ParsedSelector = { classes: [] }
    let pos = 0

    if (pos < selector.length && /[a-zA-Z]/.test(selector[pos])) {
        const start = pos
        while (pos < selector.length && /[a-zA-Z0-9-]/.test(selector[pos])) pos++
        result.tag = selector.substring(start, pos)
    }

    while (pos < selector.length) {
        if (selector[pos] === '#') {
            pos++
            const start = pos
            while (pos < selector.length && /[a-zA-Z0-9_-]/.test(selector[pos])) pos++
            result.id = selector.substring(start, pos)
        } else if (selector[pos] === '.') {
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
    if (trimmed === ':root') return node.parent === null

    const parts = splitIntoParts(trimmed)
    if (parts.length === 0) return false

    return matchParts(node, parts, parts.length - 1)
}

function splitIntoParts(selector: string): SelectorPart[] {
    const parts: SelectorPart[] = []
    const tokens = tokenizeSelector(selector)

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        if (token === '>' || token === ' ') continue

        const combinator = i > 0 ? (tokens[i - 1] === '>' ? '>' : ' ') as SelectorPart['combinator'] : ''
        parts.push({ selector: parseSelector(token), combinator })
    }

    return parts
}

function tokenizeSelector(selector: string): string[] {
    const tokens: string[] = []
    let pos = 0
    let current = ''

    while (pos < selector.length) {
        const ch = selector[pos]

        if (ch === '>') {
            if (current.trim()) tokens.push(current.trim())
            tokens.push('>')
            current = ''
            pos++
        } else if (ch === ' ') {
            if (current.trim()) {
                tokens.push(current.trim())
                // Check if next non-space is '>' — if so, the space is just whitespace around >
                let next = pos + 1
                while (next < selector.length && selector[next] === ' ') next++
                if (next < selector.length && selector[next] !== '>') {
                    tokens.push(' ')
                }
            }
            current = ''
            pos++
        } else {
            current += ch
            pos++
        }
    }

    if (current.trim()) tokens.push(current.trim())
    return tokens
}

function matchParts(node: TermNode, parts: SelectorPart[], index: number): boolean {
    const part = parts[index]
    if (!matchesParsed(node, part.selector)) return false

    if (index === 0) return true // all parts matched

    const combinator = parts[index].combinator

    if (combinator === '>') {
        // Direct parent must match
        if (!node.parent || node.parent.nodeType !== 'element') return false
        return matchParts(node.parent, parts, index - 1)
    }

    // Descendant: any ancestor must match
    let ancestor = node.parent
    while (ancestor) {
        if (ancestor.nodeType === 'element' && matchParts(ancestor, parts, index - 1)) {
            return true
        }
        ancestor = ancestor.parent
    }

    return false
}

function matchesParsed(node: TermNode, parsed: ParsedSelector): boolean {
    if (parsed.tag && node.tag !== parsed.tag) return false
    if (parsed.id && node.attributes.get('id') !== parsed.id) return false

    const nodeClasses = node.classes
    for (const cls of parsed.classes) {
        if (!nodeClasses.has(cls)) return false
    }

    if (parsed.pseudo) {
        if (parsed.pseudo === 'focus') {
            return node.attributes.get('data-focused') === 'true'
        }
        if (parsed.pseudo === 'root') {
            return node.parent === null
        }
        return false
    }

    return true
}
