/**
 * Evaluate CSS math functions: calc(), min(), max(), clamp().
 * Returns the computed cell value, or null if the input is not a math function.
 */
export function evaluateCalc(value: string, available: number): number | null {
    const trimmed = value.trim()

    if (trimmed.startsWith('calc(')) {
        const expr = trimmed.slice(5, -1).trim()
        return Math.round(evaluateExpression(expr, available))
    }

    if (trimmed.startsWith('min(')) {
        const args = splitArgs(trimmed.slice(4, -1))
        const values = args.map(a => resolveValue(a.trim(), available))
        return Math.round(Math.min(...values))
    }

    if (trimmed.startsWith('max(')) {
        const args = splitArgs(trimmed.slice(4, -1))
        const values = args.map(a => resolveValue(a.trim(), available))
        return Math.round(Math.max(...values))
    }

    if (trimmed.startsWith('clamp(')) {
        const args = splitArgs(trimmed.slice(6, -1))
        if (args.length !== 3) return null
        const min = resolveValue(args[0].trim(), available)
        const preferred = resolveValue(args[1].trim(), available)
        const max = resolveValue(args[2].trim(), available)
        return Math.round(Math.min(Math.max(preferred, min), max))
    }

    return null
}

function evaluateExpression(expr: string, available: number): number {
    // Tokenize: split on +, -, *, / while preserving the operators
    const tokens = tokenize(expr)
    if (tokens.length === 0) return 0

    // First pass: resolve values
    const values: number[] = []
    const ops: string[] = []

    for (const token of tokens) {
        if (token === '+' || token === '-' || token === '*' || token === '/') {
            ops.push(token)
        } else {
            values.push(resolveValue(token.trim(), available))
        }
    }

    // Second pass: * and / first
    let i = 0
    while (i < ops.length) {
        if (ops[i] === '*') {
            values[i] = values[i] * values[i + 1]
            values.splice(i + 1, 1)
            ops.splice(i, 1)
        } else if (ops[i] === '/') {
            values[i] = values[i] / values[i + 1]
            values.splice(i + 1, 1)
            ops.splice(i, 1)
        } else {
            i++
        }
    }

    // Third pass: + and -
    let result = values[0]
    for (let j = 0; j < ops.length; j++) {
        if (ops[j] === '+') result += values[j + 1]
        else if (ops[j] === '-') result -= values[j + 1]
    }

    return result
}

function tokenize(expr: string): string[] {
    const tokens: string[] = []
    let current = ''

    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i]
        if ((ch === '+' || ch === '-') && current.trim() && i > 0 && expr[i - 1] !== '(') {
            tokens.push(current.trim())
            tokens.push(ch)
            current = ''
        } else if (ch === '*' || ch === '/') {
            tokens.push(current.trim())
            tokens.push(ch)
            current = ''
        } else {
            current += ch
        }
    }

    if (current.trim()) tokens.push(current.trim())
    return tokens.filter(Boolean)
}

function resolveValue(value: string, available: number): number {
    const trimmed = value.trim()
    if (trimmed.endsWith('%')) {
        return available * parseFloat(trimmed) / 100
    }
    if (trimmed.endsWith('cell')) {
        return parseFloat(trimmed)
    }
    // Bare number (for multipliers like * 2)
    const num = parseFloat(trimmed)
    return isNaN(num) ? 0 : num
}

function splitArgs(argsStr: string): string[] {
    const args: string[] = []
    let current = ''
    let depth = 0

    for (const ch of argsStr) {
        if (ch === '(') depth++
        if (ch === ')') depth--
        if (ch === ',' && depth === 0) {
            args.push(current)
            current = ''
        } else {
            current += ch
        }
    }

    if (current.trim()) args.push(current)
    return args
}
