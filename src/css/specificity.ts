/**
 * Compute CSS specificity as [id, class, element] tuple.
 * Higher tuple wins. Equal specificity: later rule wins.
 */
export function computeSpecificity(selector: string): [number, number, number] {
    let ids = 0
    let classes = 0
    let elements = 0
    let pos = 0

    while (pos < selector.length) {
        const ch = selector[pos]

        if (ch === '*') {
            pos++ // universal: 0 specificity
        } else if (ch === '#') {
            ids++
            pos++
            pos = skipName(selector, pos)
        } else if (ch === '.') {
            classes++
            pos++
            pos = skipName(selector, pos)
        } else if (ch === '[') {
            classes++ // attribute selector = class-level
            pos = skipUntil(selector, pos, ']') + 1
        } else if (ch === ':') {
            pos++
            const nameStart = pos
            pos = skipName(selector, pos)
            const name = selector.substring(nameStart, pos)

            if ((name === 'not' || name === 'is' || name === 'where') && pos < selector.length && selector[pos] === '(') {
                // :not()/:is() specificity = most specific argument; :where() = zero
                pos++
                const argStart = pos
                let depth = 1
                while (pos < selector.length && depth > 0) {
                    if (selector[pos] === '(') depth++
                    else if (selector[pos] === ')') depth--
                    if (depth > 0) pos++
                }
                const arg = selector.substring(argStart, pos)
                pos++ // skip )
                if (name !== 'where') {
                    const argSpec = mostSpecificArgument(arg)
                    ids += argSpec[0]; classes += argSpec[1]; elements += argSpec[2]
                }
            } else if (pos < selector.length && selector[pos] === '(') {
                classes++ // other functional pseudo-class
                pos = skipUntil(selector, pos, ')') + 1
            } else {
                classes++ // simple pseudo-class
            }
        } else if (/[a-zA-Z]/.test(ch)) {
            elements++
            pos = skipName(selector, pos)
        } else {
            pos++ // whitespace, combinators
        }
    }

    return [ids, classes, elements]
}

function mostSpecificArgument(list: string): [number, number, number] {
    let best: [number, number, number] = [0, 0, 0]
    for (const item of list.split(',')) {
        const spec = computeSpecificity(item.trim())
        if (compareSpecificity(spec, best) > 0) best = spec
    }
    return best
}

function skipName(selector: string, pos: number): number {
    while (pos < selector.length && /[a-zA-Z0-9_-]/.test(selector[pos])) pos++
    return pos
}

function skipUntil(selector: string, pos: number, char: string): number {
    while (pos < selector.length && selector[pos] !== char) pos++
    return pos
}

/** Compare two specificity tuples. Returns positive if a wins, negative if b wins, 0 if equal. */
export function compareSpecificity(a: [number, number, number], b: [number, number, number]): number {
    if (a[0] !== b[0]) return a[0] - b[0]
    if (a[1] !== b[1]) return a[1] - b[1]
    return a[2] - b[2]
}
