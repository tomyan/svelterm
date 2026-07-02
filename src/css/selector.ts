import { TermNode } from '../renderer/node.js'

export interface ParsedSelector {
    tag?: string
    id?: string
    classes: string[]
    pseudos: PseudoSelector[]
    attributes: AttrSelector[]
    universal?: boolean
}

interface PseudoSelector {
    name: string
    arg?: string              // argument for functional pseudo-classes like :not(.foo)
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
    const result: ParsedSelector = { classes: [], pseudos: [], attributes: [] }
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

            // Functional pseudo-class: :not(...), :where(...), :is(...)
            let arg: string | undefined
            if (pos < selector.length && selector[pos] === '(') {
                pos++
                const argStart = pos
                let depth = 1
                while (pos < selector.length && depth > 0) {
                    if (selector[pos] === '(') depth++
                    else if (selector[pos] === ')') depth--
                    if (depth > 0) pos++
                }
                arg = selector.substring(argStart, pos).trim()
                pos++ // skip closing )
            }

            result.pseudos.push({ name, arg })
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

    for (const pseudo of parsed.pseudos) {
        if (!matchesPseudo(node, pseudo.name, pseudo.arg)) return false
    }

    return true
}

function matchesPseudo(node: TermNode, pseudo: string, arg?: string): boolean {
    switch (pseudo) {
        case 'root': return node.parent === null
        case 'focus': return node.attributes.get('data-focused') === 'true'
        case 'hover': return node.attributes.get('data-hovered') === 'true'
        case 'first-child': return isFirstChild(node)
        case 'last-child': return isLastChild(node)
        case 'not':
            if (!arg) return false
            return !matchesParsed(node, parseSelector(arg))
        case 'where':
        case 'is':
            if (!arg) return false
            return matchesSelectorList(node, arg)
        case 'nth-child':
            return matchesNth(node, arg, { fromEnd: false, sameType: false })
        case 'nth-last-child':
            return matchesNth(node, arg, { fromEnd: true, sameType: false })
        case 'nth-of-type':
            return matchesNth(node, arg, { fromEnd: false, sameType: true })
        case 'nth-last-of-type':
            return matchesNth(node, arg, { fromEnd: true, sameType: true })
        default: return false
    }
}

function matchesNth(
    node: TermNode, arg: string | undefined,
    opts: { fromEnd: boolean; sameType: boolean },
): boolean {
    if (!arg || !node.parent) return false
    const siblings = node.parent.children.filter(c =>
        c.nodeType === 'element' && (!opts.sameType || c.tag === node.tag))
    const position = siblings.indexOf(node)
    if (position < 0) return false
    const index = opts.fromEnd ? siblings.length - position : position + 1
    const formula = parseNth(arg)
    if (!formula) return false
    const { a, b } = formula
    // index = a*n + b for some integer n >= 0
    if (a === 0) return index === b
    const n = (index - b) / a
    return n >= 0 && Number.isInteger(n)
}

/** Parse an An+B expression ("odd", "even", "3", "2n", "2n+1", "-n+3"). */
function parseNth(arg: string): { a: number; b: number } | null {
    const s = arg.trim().toLowerCase()
    if (s === 'odd') return { a: 2, b: 1 }
    if (s === 'even') return { a: 2, b: 0 }
    const match = /^([+-]?\d*)n\s*(?:([+-])\s*(\d+))?$|^([+-]?\d+)$/.exec(s)
    if (!match) return null
    if (match[4] !== undefined) return { a: 0, b: parseInt(match[4]) }
    const aText = match[1]
    const a = aText === '' || aText === '+' ? 1 : aText === '-' ? -1 : parseInt(aText)
    const b = match[2] ? (match[2] === '-' ? -1 : 1) * parseInt(match[3]) : 0
    return { a, b }
}

/** Match a comma-separated list of compound selectors (the argument of :where()/:is()). */
function matchesSelectorList(node: TermNode, list: string): boolean {
    return list.split(',').some(item => matchesParsed(node, parseSelector(item.trim())))
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
