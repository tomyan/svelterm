export interface CSSDeclaration {
    property: string
    value: string
}

export interface CSSRule {
    selectors: string[]
    declarations: CSSDeclaration[]
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

        // Parse selector(s)
        const selectorEnd = css.indexOf('{', pos)
        if (selectorEnd === -1) break

        const selectorText = css.substring(pos, selectorEnd).trim()
        const selectors = selectorText.split(',').map(s => s.trim()).filter(Boolean)

        pos = selectorEnd + 1

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

        if (selectors.length > 0 && declarations.length > 0) {
            rules.push({ selectors, declarations })
        }
    }

    return { rules }
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
