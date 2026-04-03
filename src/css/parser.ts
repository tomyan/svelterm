export interface CSSDeclaration {
    property: string
    value: string
}

export interface CSSRule {
    selectors: string[]
    declarations: CSSDeclaration[]
    media?: string  // media query condition, if inside @media block
}

export interface CSSStyleSheet {
    rules: CSSRule[]
}

export function parseCSS(css: string): CSSStyleSheet {
    const rules: CSSRule[] = []
    let pos = 0

    while (pos < css.length) {
        pos = skipWhitespaceAndComments(css, pos)
        if (pos >= css.length) break

        // Check for @media block
        if (css.substring(pos, pos + 6) === '@media') {
            pos = parseMediaBlock(css, pos, rules)
            continue
        }

        pos = parseRule(css, pos, rules, undefined)
    }

    return { rules }
}

function parseMediaBlock(css: string, start: number, rules: CSSRule[]): number {
    let pos = start + 6 // skip "@media"
    pos = skipWhitespace(css, pos)

    // Parse condition — content between ( and ) before the {
    // Handle both @media(condition) and @media (condition)
    const condStart = css.indexOf('(', pos)
    if (condStart === -1) return skipToClosingBrace(css, pos)

    const condEnd = css.indexOf(')', condStart)
    if (condEnd === -1) return skipToClosingBrace(css, pos)

    const condition = css.substring(condStart + 1, condEnd).trim()

    pos = condEnd + 1
    pos = skipWhitespace(css, pos)
    if (pos >= css.length || css[pos] !== '{') return pos
    pos++ // skip {

    // Parse rules inside the @media block
    while (pos < css.length) {
        pos = skipWhitespaceAndComments(css, pos)
        if (pos >= css.length || css[pos] === '}') {
            pos++
            break
        }
        pos = parseRule(css, pos, rules, condition)
    }

    return pos
}

function parseRule(css: string, start: number, rules: CSSRule[], media: string | undefined): number {
    let pos = start

    const selectorEnd = css.indexOf('{', pos)
    if (selectorEnd === -1) return css.length

    const selectorText = css.substring(pos, selectorEnd).trim()
    const selectors = selectorText.split(',').map(s => s.trim()).filter(Boolean)

    pos = selectorEnd + 1

    const declarations: CSSDeclaration[] = []
    while (pos < css.length) {
        pos = skipWhitespace(css, pos)
        if (pos >= css.length || css[pos] === '}') {
            pos++
            break
        }

        const colonPos = css.indexOf(':', pos)
        if (colonPos === -1) break

        const property = css.substring(pos, colonPos).trim()
        const valueEnd = findValueEnd(css, colonPos + 1)
        const value = css.substring(colonPos + 1, valueEnd).trim()

        declarations.push({ property, value })
        pos = valueEnd
        if (pos < css.length && css[pos] === ';') pos++
    }

    if (selectors.length > 0 && declarations.length > 0) {
        rules.push({ selectors, declarations, media })
    }

    return pos
}

function skipToClosingBrace(css: string, pos: number): number {
    let depth = 0
    while (pos < css.length) {
        if (css[pos] === '{') depth++
        else if (css[pos] === '}') {
            if (depth === 0) return pos + 1
            depth--
        }
        pos++
    }
    return pos
}

function findValueEnd(css: string, start: number): number {
    let pos = start
    let depth = 0
    while (pos < css.length) {
        const ch = css[pos]
        if (ch === '(') depth++
        else if (ch === ')') depth--
        else if (depth === 0 && (ch === ';' || ch === '}')) return pos
        pos++
    }
    return pos
}

function skipWhitespace(css: string, pos: number): number {
    while (pos < css.length && /\s/.test(css[pos])) pos++
    return pos
}

function skipWhitespaceAndComments(css: string, pos: number): number {
    while (pos < css.length) {
        pos = skipWhitespace(css, pos)
        if (pos + 1 < css.length && css[pos] === '/' && css[pos + 1] === '*') {
            const end = css.indexOf('*/', pos + 2)
            pos = end === -1 ? css.length : end + 2
        } else {
            break
        }
    }
    return pos
}
