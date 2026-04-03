const ANSI_COLOR_NAMES: Record<string, string> = {
    black: 'black', red: 'red', green: 'green', yellow: 'yellow',
    blue: 'blue', magenta: 'magenta', cyan: 'cyan', white: 'white',
}

const ANSI_RGB: Record<string, [number, number, number]> = {
    black: [0, 0, 0], red: [255, 0, 0], green: [0, 255, 0], yellow: [255, 255, 0],
    blue: [0, 0, 255], magenta: [255, 0, 255], cyan: [0, 255, 255], white: [255, 255, 255],
}

export function resolveColor(value: string): string {
    const ansiName = ANSI_COLOR_NAMES[value.toLowerCase()]
    if (ansiName) return ansiName

    if (value.startsWith('#')) {
        const expanded = expandHex(value)
        return hexToNearestAnsi(expanded) ?? expanded
    }

    return 'default'
}

function expandHex(hex: string): string {
    const h = hex.slice(1)
    if (h.length === 3) return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    return hex
}

function hexToNearestAnsi(hex: string): string | null {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)

    for (const [name, [cr, cg, cb]] of Object.entries(ANSI_RGB)) {
        if (r === cr && g === cg && b === cb) return name
    }
    return null
}
