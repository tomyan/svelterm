import { TermNode } from '../renderer/node.js'

export interface ParsedSelector {
    tag?: string
    id?: string
    classes: string[]
    pseudo?: string
    pseudoArg?: string        // argument for functional pseudo-classes like :not(.foo)
    attributes: AttrSelector[]
    universal?: boolean
}

interface AttrSelector {
    name: string
    value?: string            // if present, match exact value
}

interface SelectorPart {
    selector: ParsedSelector
    combinator: '' | '>' | ' ' | '+' | '~'
}

export function parseSelector(selector: string): ParsedSelector {
    const result: ParsedSelector = { classes: [], attributes: [] }
    let pos = 0

    // Universal selector
    if (pos < selector.length && selector[pos] === '*') {
        result.universal = true
        pos++
    }

    // Tag name
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
        } else if (selector[pos] === '[') {
            pos++
            const attr = parseAttrSelector(selector, pos)
            result.attributes.push(attr.selector)
            pos = attr.end
        } else if (selector[pos] === ':') {
            pos++
            const start = pos
            while (pos < selector.length && /[a-zA-Z0-9_-]/.test(selector[pos])) pos++
            const name = selector.substring(start, pos)

            // Functional pseudo-class: :not(...), :nth-child(...)
            if (pos < selector.length && selector[pos] === '(') {
                pos++
                const argStart = pos
                let depth = 1
                while (pos < selector.length && depth > 0) {
                    if (selector[pos] === '(') depth++
                    else if (selector[pos] === ')') depth--
                    if (depth > 0) pos++
                }
                result.pseudoArg = selector.substring(argStart, pos).trim()
                pos++ // skip closing )
            }

            result.pseudo = name
        } else {
            pos++
        }
    }

    return result
}

function parseAttrSelector(selector: string, pos: number): { selector: AttrSelector; end: number } {
    const nameStart = pos
    while (pos < selector.length && selector[pos] !== '=' && selector[pos] !== ']') pos++
    const name = selector.substring(nameStart, pos).trim()

    if (pos < selector.length && selector[pos] === '=') {
        pos++ // skip =
        let value = ''
        if (pos < selector.length && (selector[pos] === '"' || selector[pos] === "'")) {
            const quote = selector[pos]
            pos++
            const valStart = pos
            while (pos < selector.length && selector[pos] !== quote) pos++
            value = selector.substring(valStart, pos)
            pos++ // skip closing quote
        }
        while (pos < selector.length && selector[pos] !== ']') pos++
        pos++ // skip ]
        return { selector: { name, value }, end: pos }
    }

    while (pos < selector.length && selector[pos] !== ']') pos++
    pos++ // skip ]
    return { selector: { name }, end: pos }
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
        if (token === '>' || token === ' ' || token === '+' || token === '~') continue

        let combinator: SelectorPart['combinator'] = ''
        if (i > 0) {
            const prev = tokens[i - 1]
            if (prev === '>' || prev === '+' || prev === '~') combinator = prev
            else combinator = ' '
        }
        parts.push({ selector: parseSelector(token), combinator })
    }

    return parts
}

function tokenizeSelector(selector: string): string[] {
    const tokens: string[] = []
    let pos = 0
    let current = ''
    let bracketDepth = 0
    let parenDepth = 0

    while (pos < selector.length) {
        const ch = selector[pos]

        if (ch === '[') bracketDepth++
        if (ch === ']') bracketDepth--
        if (ch === '(') parenDepth++
        if (ch === ')') parenDepth--

        if (bracketDepth > 0 || parenDepth > 0) {
            current += ch
            pos++
            continue
        }

        if (ch === '>' || ch === '+' || ch === '~') {
            if (current.trim()) tokens.push(current.trim())
            tokens.push(ch)
            current = ''
            pos++
        } else if (ch === ' ') {
            if (current.trim()) {
                tokens.push(current.trim())
                let next = pos + 1
                while (next < selector.length && selector[next] === ' ') next++
                if (next < selector.length && !'> +~'.includes(selector[next])) {
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

    if (index === 0) return true

    const combinator = parts[index].combinator

    if (combinator === '>') {
        if (!node.parent || node.parent.nodeType !== 'element') return false
        return matchParts(node.parent, parts, index - 1)
    }

    if (combinator === '+') {
        const prev = getPreviousElementSibling(node)
        if (!prev) return false
        return matchParts(prev, parts, index - 1)
    }

    if (combinator === '~') {
        if (!node.parent) return false
        const siblings = node.parent.children
        const myIndex = siblings.indexOf(node)
        for (let i = myIndex - 1; i >= 0; i--) {
            if (siblings[i].nodeType === 'element' && matchParts(siblings[i], parts, index - 1)) {
                return true
            }
        }
        return false
    }

    // Descendant: any ancestor
    let ancestor = node.parent
    while (ancestor) {
        if (ancestor.nodeType === 'element' && matchParts(ancestor, parts, index - 1)) {
            return true
        }
        ancestor = ancestor.parent
    }

    return false
}

function getPreviousElementSibling(node: TermNode): TermNode | null {
    if (!node.parent) return null
    const siblings = node.parent.children
    const idx = siblings.indexOf(node)
    for (let i = idx - 1; i >= 0; i--) {
        if (siblings[i].nodeType === 'element') return siblings[i]
    }
    return null
}

function matchesParsed(node: TermNode, parsed: ParsedSelector): boolean {
    if (parsed.tag && node.tag !== parsed.tag) return false
    if (parsed.id && node.attributes.get('id') !== parsed.id) return false

    const nodeClasses = node.classes
    for (const cls of parsed.classes) {
        if (!nodeClasses.has(cls)) return false
    }

    for (const attr of parsed.attributes) {
        if (!node.attributes.has(attr.name)) return false
        if (attr.value !== undefined && node.attributes.get(attr.name) !== attr.value) return false
    }

    if (parsed.pseudo) {
        if (!matchesPseudo(node, parsed.pseudo, parsed.pseudoArg)) return false
    }

    return true
}

function matchesPseudo(node: TermNode, pseudo: string, arg?: string): boolean {
    switch (pseudo) {
        case 'root': return node.parent === null
        case 'focus': return node.attributes.get('data-focused') === 'true'
        case 'first-child': return isFirstChild(node)
        case 'last-child': return isLastChild(node)
        case 'not':
            if (!arg) return false
            return !matchesParsed(node, parseSelector(arg))
        default: return false
    }
}

function isFirstChild(node: TermNode): boolean {
    if (!node.parent) return false
    const siblings = node.parent.children.filter(c => c.nodeType === 'element')
    return siblings[0] === node
}

function isLastChild(node: TermNode): boolean {
    if (!node.parent) return false
    const siblings = node.parent.children.filter(c => c.nodeType === 'element')
    return siblings[siblings.length - 1] === node
}
