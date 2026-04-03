const ANSI_COLORS: Record<string, string> = {
    black: 'black', red: 'red', green: 'green', yellow: 'yellow',
    blue: 'blue', magenta: 'magenta', cyan: 'cyan', white: 'white',
}

const ANSI_RGB: Record<string, [number, number, number]> = {
    black: [0, 0, 0], red: [255, 0, 0], green: [0, 255, 0], yellow: [255, 255, 0],
    blue: [0, 0, 255], magenta: [255, 0, 255], cyan: [0, 255, 255], white: [255, 255, 255],
}

export function resolveColor(value: string): string {
    const lower = value.toLowerCase().trim()

    // ANSI named colors (exact match, highest priority)
    const ansiName = ANSI_COLORS[lower]
    if (ansiName) return ansiName

    // Hex colors
    if (lower.startsWith('#')) {
        const expanded = expandHex(lower)
        return hexToNearestAnsi(expanded) ?? expanded
    }

    // rgb() / rgba()
    if (lower.startsWith('rgb')) {
        return parseRgbFunc(lower)
    }

    // hsl() / hsla()
    if (lower.startsWith('hsl')) {
        return parseHslFunc(lower)
    }

    // CSS named colors
    const named = CSS_NAMED_COLORS[lower]
    if (named) return named

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

function parseRgbFunc(value: string): string {
    const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (!match) return 'default'
    const r = parseInt(match[1])
    const g = parseInt(match[2])
    const b = parseInt(match[3])
    return rgbToColor(r, g, b)
}

function parseHslFunc(value: string): string {
    const match = value.match(/hsla?\(\s*(\d+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/)
    if (!match) return 'default'
    const h = parseInt(match[1])
    const s = parseFloat(match[2]) / 100
    const l = parseFloat(match[3]) / 100
    const [r, g, b] = hslToRgb(h, s, l)
    return rgbToColor(r, g, b)
}

function rgbToColor(r: number, g: number, b: number): string {
    const hex = '#' + toHex(r) + toHex(g) + toHex(b)
    return hexToNearestAnsi(hex) ?? hex
}

function toHex(n: number): string {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    if (s === 0) {
        const v = Math.round(l * 255)
        return [v, v, v]
    }
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = l - c / 2

    let r = 0, g = 0, b = 0
    if (h < 60) { r = c; g = x }
    else if (h < 120) { r = x; g = c }
    else if (h < 180) { g = c; b = x }
    else if (h < 240) { g = x; b = c }
    else if (h < 300) { r = x; b = c }
    else { r = c; b = x }

    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255),
    ]
}

// CSS Level 4 named colors (subset — most commonly used)
const CSS_NAMED_COLORS: Record<string, string> = {
    aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
    azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', blanchedalmond: '#ffebcd',
    blueviolet: '#8a2be2', brown: '#a52a2a', burlywood: '#deb887', cadetblue: '#5f9ea0',
    chartreuse: '#7fff00', chocolate: '#d2691e', coral: '#ff7f50', cornflowerblue: '#6495ed',
    cornsilk: '#fff8dc', crimson: '#dc143c', darkblue: '#00008b', darkcyan: '#008b8b',
    darkgoldenrod: '#b8860b', darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9',
    darkkhaki: '#bdb76b', darkmagenta: '#8b008b', darkolivegreen: '#556b2f',
    darkorange: '#ff8c00', darkorchid: '#9932cc', darkred: '#8b0000', darksalmon: '#e9967a',
    darkseagreen: '#8fbc8f', darkslateblue: '#483d8b', darkslategray: '#2f4f4f',
    darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3',
    deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969',
    dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0',
    forestgreen: '#228b22', fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff',
    gold: '#ffd700', goldenrod: '#daa520', gray: '#808080', grey: '#808080',
    greenyellow: '#adff2f', honeydew: '#f0fff0', hotpink: '#ff69b4',
    indianred: '#cd5c5c', indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c',
    lavender: '#e6e6fa', lavenderblush: '#fff0f5', lawngreen: '#7cfc00',
    lemonchiffon: '#fffacd', lightblue: '#add8e6', lightcoral: '#f08080',
    lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
    lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1',
    lightsalmon: '#ffa07a', lightseagreen: '#20b2aa', lightskyblue: '#87cefa',
    lightslategray: '#778899', lightslategrey: '#778899', lightsteelblue: '#b0c4de',
    lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32', linen: '#faf0e6',
    maroon: '#800000', mediumaquamarine: '#66cdaa', mediumblue: '#0000cd',
    mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371',
    mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc',
    mediumvioletred: '#c71585', midnightblue: '#191970', mintcream: '#f5fffa',
    mistyrose: '#ffe4e1', moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080',
    oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23', orange: '#ffa500',
    orangered: '#ff4500', orchid: '#da70d6', palegoldenrod: '#eee8aa',
    palegreen: '#98fb98', paleturquoise: '#afeeee', palevioletred: '#db7093',
    papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb',
    plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399',
    rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513',
    salmon: '#fa8072', sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee',
    sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd',
    slategray: '#708090', slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f',
    steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8',
    tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3',
    whitesmoke: '#f5f5f5', yellowgreen: '#9acd32',
}
