export interface CSSDeclaration {
    property: string
    value: string
}

export interface CSSRule {
    selectors: string[]
    declarations: CSSDeclaration[]
    media?: string     // media query condition, if inside @media block
    supports?: string  // @supports condition
}

export interface KeyframeStop {
    offset: number  // 0 to 1
    declarations: CSSDeclaration[]
}

export interface CSSStyleSheet {
    rules: CSSRule[]
    keyframes: Map<string, KeyframeStop[]>
}

export function parseCSS(css: string): CSSStyleSheet {
    const rules: CSSRule[] = []
    const keyframes = new Map<string, KeyframeStop[]>()
    let pos = 0

    while (pos < css.length) {
        pos = skipWhitespaceAndComments(css, pos)
        if (pos >= css.length) break

        // Check for @-rules
        if (css.substring(pos, pos + 6) === '@media') {
            pos = parseMediaBlock(css, pos, rules)
            continue
        }

        if (css.substring(pos, pos + 9) === '@supports') {
            pos = parseSupportsBlock(css, pos, rules)
            continue
        }

        if (css.substring(pos, pos + 11) === '@keyframes ') {
            pos = parseKeyframesBlock(css, pos, keyframes)
            continue
        }

        if (css.substring(pos, pos + 7) === '@import') {
            // Skip @import — handled by bundler
            pos = css.indexOf(';', pos)
            if (pos === -1) pos = css.length
            else pos++
            continue
        }

        pos = parseRule(css, pos, rules, undefined)
    }

    return { rules, keyframes }
}

function parseMediaBlock(css: string, start: number, rules: CSSRule[]): number {
    let pos = start + 6 // skip "@media"
    pos = skipWhitespace(css, pos)

    // Capture everything between @media and { as the condition string
    const bracePos = css.indexOf('{', pos)
    if (bracePos === -1) return skipToClosingBrace(css, pos)

    const rawCondition = css.substring(pos, bracePos).trim()
    // Strip outer parens if single condition: "(foo: bar)" -> "foo: bar"
    // Keep as-is for compound: "(foo: bar) and (baz: qux)"
    const condition = rawCondition.startsWith('(') && !rawCondition.includes(') and (')
        ? rawCondition.slice(1, -1).trim()
        : rawCondition

    pos = bracePos + 1

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

function parseKeyframesBlock(css: string, start: number, keyframes: Map<string, KeyframeStop[]>): number {
    let pos = start + 11 // skip "@keyframes "
    pos = skipWhitespace(css, pos)

    // Parse name
    const nameStart = pos
    while (pos < css.length && css[pos] !== '{' && css[pos] !== ' ') pos++
    const name = css.substring(nameStart, pos).trim()

    pos = skipWhitespace(css, pos)
    if (pos >= css.length || css[pos] !== '{') return pos
    pos++ // skip {

    const stops: KeyframeStop[] = []

    while (pos < css.length) {
        pos = skipWhitespaceAndComments(css, pos)
        if (pos >= css.length || css[pos] === '}') {
            pos++
            break
        }

        // Parse offset: "from", "to", or percentage
        const offsetEnd = css.indexOf('{', pos)
        if (offsetEnd === -1) break
        const offsetStr = css.substring(pos, offsetEnd).trim()
        let offset = 0
        if (offsetStr === 'from') offset = 0
        else if (offsetStr === 'to') offset = 1
        else if (offsetStr.endsWith('%')) offset = parseFloat(offsetStr) / 100

        pos = offsetEnd + 1

        // Parse declarations
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

        stops.push({ offset, declarations })
    }

    if (name && stops.length > 0) {
        keyframes.set(name, stops)
    }

    return pos
}

function parseSupportsBlock(css: string, start: number, rules: CSSRule[]): number {
    let pos = start + 9 // skip "@supports"
    pos = skipWhitespace(css, pos)

    const bracePos = css.indexOf('{', pos)
    if (bracePos === -1) return skipToClosingBrace(css, pos)

    let condition = css.substring(pos, bracePos).trim()
    if (condition.startsWith('(')) condition = condition.slice(1, -1).trim()

    pos = bracePos + 1

    // Parse rules inside
    while (pos < css.length) {
        pos = skipWhitespaceAndComments(css, pos)
        if (pos >= css.length || css[pos] === '}') {
            pos++
            break
        }
        pos = parseRule(css, pos, rules, undefined, condition)
    }

    return pos
}

function parseRule(css: string, start: number, rules: CSSRule[], media: string | undefined, supports?: string): number {
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
        rules.push({ selectors, declarations, media, supports })
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
