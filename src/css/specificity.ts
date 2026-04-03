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

        if (ch === '#') {
            ids++
            pos++
            pos = skipName(selector, pos)
        } else if (ch === '.') {
            classes++
            pos++
            pos = skipName(selector, pos)
        } else if (ch === ':') {
            // Pseudo-class counts as class-level specificity
            // (pseudo-elements :: would be element-level but we don't support them)
            classes++
            pos++
            pos = skipName(selector, pos)
        } else if (/[a-zA-Z]/.test(ch)) {
            elements++
            pos = skipName(selector, pos)
        } else {
            pos++
        }
    }

    return [ids, classes, elements]
}

function skipName(selector: string, pos: number): number {
    while (pos < selector.length && /[a-zA-Z0-9_-]/.test(selector[pos])) pos++
    return pos
}

/** Compare two specificity tuples. Returns positive if a wins, negative if b wins, 0 if equal. */
export function compareSpecificity(a: [number, number, number], b: [number, number, number]): number {
    if (a[0] !== b[0]) return a[0] - b[0]
    if (a[1] !== b[1]) return a[1] - b[1]
    return a[2] - b[2]
}
