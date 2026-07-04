/**
 * CSS Color Level 4 parser and resolver.
 *
 * Supports: hex (#rgb, #rrggbb, #rrggbbaa), rgb(), hsl(), hwb(),
 * lab(), lch(), oklab(), oklch(), named colours, transparent,
 * light-dark(a, b) (resolved against the active colorScheme).
 * Both legacy comma syntax and modern space + / alpha syntax.
 */

// --- Public API ---

/**
 * Expand `light-dark(a, b)` to whichever side matches the active scheme.
 * Recursive on the chosen side so `light-dark(light-dark(...), x)` works.
 * Returns the input unchanged when no light-dark() call is present.
 */
export function expandLightDark(value: string, scheme: 'dark' | 'light' = 'dark'): string {
    if (!value.includes('light-dark(')) return value
    const start = value.indexOf('light-dark(')
    const argsStart = start + 'light-dark('.length
    // Find the matching closing paren (track nesting for nested colour funcs).
    let depth = 1
    let i = argsStart
    while (i < value.length && depth > 0) {
        const ch = value[i]
        if (ch === '(') depth++
        else if (ch === ')') depth--
        if (depth === 0) break
        i++
    }
    if (depth !== 0) return value // unbalanced — give up, let resolveColor fail loudly
    const args = value.slice(argsStart, i)
    // Split on the comma at depth 0 (commas inside nested parens aren't separators).
    let split = -1
    let d = 0
    for (let j = 0; j < args.length; j++) {
        const ch = args[j]
        if (ch === '(') d++
        else if (ch === ')') d--
        else if (ch === ',' && d === 0) { split = j; break }
    }
    if (split < 0) return value
    const lightArg = args.slice(0, split).trim()
    const darkArg = args.slice(split + 1).trim()
    const picked = scheme === 'light' ? lightArg : darkArg
    const before = value.slice(0, start)
    const after = value.slice(i + 1)
    // Recurse so additional light-dark()s elsewhere in the string are also expanded.
    return expandLightDark(before + picked + after, scheme)
}

export function resolveColor(value: string): string {
    const lower = value.toLowerCase().trim()

    // ANSI named colors (exact match, highest priority for terminal rendering)
    if (lower in ANSI_COLORS) return ANSI_COLORS[lower]

    // transparent — terminal output has no alpha layer, so the closest
    // semantic match is "no colour set": let the parent's bg show through.
    if (lower === 'transparent') return 'default'

    // Hex colors stay truecolor, even when they equal a basic ANSI colour:
    // keywords are themeable (mapped to SGR names the terminal palette can
    // restyle), an explicit hex is exact.
    if (lower.startsWith('#')) {
        return expandHex(lower)
    }

    // Color functions
    const funcMatch = lower.match(/^(\w+)\((.+)\)$/)
    if (funcMatch) {
        const rgb = parseColorFunction(funcMatch[1], funcMatch[2])
        if (rgb) {
            const alpha = parseFunctionAlpha(funcMatch[1], funcMatch[2])
            if (alpha <= 0) return 'default'
            const base = rgbToColor(rgb[0], rgb[1], rgb[2])
            return alpha < 1 ? base + toHex(Math.round(alpha * 255)) : base
        }
    }

    // CSS named colors
    if (lower in CSS_NAMED_COLORS) return CSS_NAMED_COLORS[lower]

    return 'default'
}

/** Nominal xterm values for blending over SGR colour names. */
const NOMINAL_RGB: Record<string, [number, number, number]> = {
    black: [0, 0, 0], red: [205, 0, 0], green: [0, 205, 0], yellow: [205, 205, 0],
    blue: [0, 0, 238], magenta: [205, 0, 205], cyan: [0, 205, 205], white: [229, 229, 229],
    // The terminal's actual default bg is unknowable — assume black.
    default: [0, 0, 0],
}

/**
 * Composite an alpha colour (#rrggbbaa) over a base colour, returning
 * opaque #rrggbb. Opaque over-colours return unchanged.
 */
export function blendColor(under: string, over: string): string {
    if (!over.startsWith('#') || over.length !== 9) return over
    const alpha = parseInt(over.slice(7, 9), 16) / 255
    const overRgb = [
        parseInt(over.slice(1, 3), 16),
        parseInt(over.slice(3, 5), 16),
        parseInt(over.slice(5, 7), 16),
    ]
    const underRgb = under.startsWith('#')
        ? [parseInt(under.slice(1, 3), 16), parseInt(under.slice(3, 5), 16), parseInt(under.slice(5, 7), 16)]
        : NOMINAL_RGB[under] ?? NOMINAL_RGB.default
    const mixed = overRgb.map((channel, i) =>
        Math.round(channel * alpha + underRgb[i] * (1 - alpha)))
    return '#' + mixed.map(c => toHex(c)).join('')
}

/** The alpha component of a colour-function value (legacy or modern). */
function parseFunctionAlpha(name: string, args: string): number {
    let alphaStr: string | null = null
    if (args.includes(',')) {
        const parts = args.split(',').map(s => s.trim())
        if ((name === 'rgb' || name === 'rgba' || name === 'hsl' || name === 'hsla') && parts.length >= 4) {
            alphaStr = parts[3]
        }
    } else {
        const slashIdx = args.indexOf('/')
        if (slashIdx >= 0) alphaStr = args.substring(slashIdx + 1).trim()
    }
    if (alphaStr === null) return 1
    const value = alphaStr.endsWith('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr)
    if (isNaN(value)) return 1
    return Math.max(0, Math.min(1, value))
}

// --- Color function parsing ---

function parseColorFunction(name: string, args: string): [number, number, number] | null {
    // Detect legacy comma syntax (rgb/hsl only)
    const isLegacy = args.includes(',')

    if (isLegacy) {
        const parts = args.split(',').map(s => s.trim())
        switch (name) {
            case 'rgb': case 'rgba': return parseRgbChannels(parts)
            case 'hsl': case 'hsla': return parseHslChannels(parts)
            default: return null
        }
    }

    // Modern space-separated syntax with optional / alpha
    const slashIdx = args.indexOf('/')
    const channelStr = slashIdx >= 0 ? args.substring(0, slashIdx) : args
    const parts = channelStr.trim().split(/\s+/)

    switch (name) {
        case 'rgb': case 'rgba': return parseRgbChannels(parts)
        case 'hsl': case 'hsla': return parseHslChannels(parts)
        case 'hwb': return parseHwbChannels(parts)
        case 'lab': return parseLabChannels(parts)
        case 'lch': return parseLchChannels(parts)
        case 'oklab': return parseOklabChannels(parts)
        case 'oklch': return parseOklchChannels(parts)
        default: return null
    }
}

// --- Channel parsers ---

function parseRgbChannels(parts: string[]): [number, number, number] | null {
    if (parts.length < 3) return null
    const r = parseChannelValue(parts[0], 255)
    const g = parseChannelValue(parts[1], 255)
    const b = parseChannelValue(parts[2], 255)
    if (r == null || g == null || b == null) return null
    return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)]
}

function parseHslChannels(parts: string[]): [number, number, number] | null {
    if (parts.length < 3) return null
    const h = parseAngle(parts[0])
    const s = parsePercent(parts[1])
    const l = parsePercent(parts[2])
    if (h == null || s == null || l == null) return null
    return hslToRgb(h, s, l)
}

function parseHwbChannels(parts: string[]): [number, number, number] | null {
    if (parts.length < 3) return null
    const h = parseAngle(parts[0])
    let w = parsePercent(parts[1])
    let b = parsePercent(parts[2])
    if (h == null || w == null || b == null) return null
    // Normalise when w + b > 1
    if (w + b > 1) { const t = w + b; w /= t; b /= t }
    return hwbToRgb(h, w, b)
}

function parseLabChannels(parts: string[]): [number, number, number] | null {
    if (parts.length < 3) return null
    const L = parseChannelValue(parts[0], 100)
    const a = parseFloat(parts[1])
    const b = parseFloat(parts[2])
    if (L == null || isNaN(a) || isNaN(b)) return null
    return labToRgb(L, a, b)
}

function parseLchChannels(parts: string[]): [number, number, number] | null {
    if (parts.length < 3) return null
    const L = parseChannelValue(parts[0], 100)
    const C = parseFloat(parts[1])
    const H = parseAngle(parts[2])
    if (L == null || isNaN(C) || H == null) return null
    // LCH → LAB
    const a = C * Math.cos(H * Math.PI / 180)
    const b = C * Math.sin(H * Math.PI / 180)
    return labToRgb(L, a, b)
}

function parseOklabChannels(parts: string[]): [number, number, number] | null {
    if (parts.length < 3) return null
    const L = parseChannelValue(parts[0], 1)
    const a = parseFloat(parts[1])
    const b = parseFloat(parts[2])
    if (L == null || isNaN(a) || isNaN(b)) return null
    return oklabToRgb(L, a, b)
}

function parseOklchChannels(parts: string[]): [number, number, number] | null {
    if (parts.length < 3) return null
    const L = parseChannelValue(parts[0], 1)
    const C = parseFloat(parts[1])
    const H = parseAngle(parts[2])
    if (L == null || isNaN(C) || H == null) return null
    // OKLCH → OKLAB
    const a = C * Math.cos(H * Math.PI / 180)
    const b = C * Math.sin(H * Math.PI / 180)
    return oklabToRgb(L, a, b)
}

// --- Value parsers ---

/** Parse a number or percentage. maxVal is what 100% maps to. */
function parseChannelValue(s: string, maxVal: number): number | null {
    s = s.trim()
    if (s === 'none') return 0
    if (s.endsWith('%')) {
        const v = parseFloat(s)
        return isNaN(v) ? null : (v / 100) * maxVal
    }
    const v = parseFloat(s)
    return isNaN(v) ? null : v
}

/** Parse a percentage to 0-1. */
function parsePercent(s: string): number | null {
    s = s.trim()
    if (s === 'none') return 0
    if (s.endsWith('%')) {
        const v = parseFloat(s)
        return isNaN(v) ? null : v / 100
    }
    // Allow raw 0-1 values for oklab/oklch
    const v = parseFloat(s)
    return isNaN(v) ? null : v
}

/** Parse an angle value with unit support. Returns degrees. */
function parseAngle(s: string): number | null {
    s = s.trim()
    if (s === 'none') return 0
    if (s.endsWith('grad')) return parseFloat(s) * 0.9
    if (s.endsWith('rad')) return parseFloat(s) * 180 / Math.PI
    if (s.endsWith('turn')) return parseFloat(s) * 360
    if (s.endsWith('deg')) return parseFloat(s)
    // Bare number = degrees
    const v = parseFloat(s)
    return isNaN(v) ? null : v
}

// --- Colour space conversions ---

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h = ((h % 360) + 360) % 360 // normalise hue
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

function hwbToRgb(h: number, w: number, b: number): [number, number, number] {
    // Get pure hue colour
    const [hr, hg, hb] = hslToRgb(h, 1, 0.5)
    const factor = 1 - w - b
    return [
        Math.round((hr / 255 * factor + w) * 255),
        Math.round((hg / 255 * factor + w) * 255),
        Math.round((hb / 255 * factor + w) * 255),
    ]
}

/** OKLAB → sRGB */
function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
    // Oklab → LMS
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b

    const l = l_ * l_ * l_
    const m = m_ * m_ * m_
    const s = s_ * s_ * s_

    // LMS → linear sRGB
    const lr =  4.0767416621 * l - 3.3077363322 * m + 0.2309101289 * s
    const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193761 * s
    const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    // Linear sRGB → sRGB (gamma) and scale to 0-255
    return [
        Math.round(clamp(linearToSrgb(lr), 0, 1) * 255),
        Math.round(clamp(linearToSrgb(lg), 0, 1) * 255),
        Math.round(clamp(linearToSrgb(lb), 0, 1) * 255),
    ]
}

/** LAB (CIELAB) → sRGB */
function labToRgb(L: number, a: number, b: number): [number, number, number] {
    // LAB → XYZ-D50
    const fy = (L + 16) / 116
    const fx = a / 500 + fy
    const fz = fy - b / 200

    const D50_X = 0.3457 / 0.3585
    const D50_Y = 1.0
    const D50_Z = (1 - 0.3457 - 0.3585) / 0.3585

    const x = (fx > 6 / 29 ? fx * fx * fx : (116 * fx - 16) / 903.3) * D50_X
    const y = (L > 8 ? ((L + 16) / 116) ** 3 : L / 903.3) * D50_Y
    const z = (fz > 6 / 29 ? fz * fz * fz : (116 * fz - 16) / 903.3) * D50_Z

    // XYZ-D50 → XYZ-D65 (Bradford chromatic adaptation)
    const xd =  0.9554734527 * x - 0.0230985368 * y + 0.0632593086 * z
    const yd = -0.0283697093 * x + 1.0099954580 * y + 0.0210415381 * z
    const zd =  0.0123140016 * x - 0.0205076964 * y + 1.3303899330 * z

    // XYZ-D65 → linear sRGB
    const lr =  3.2404541621 * xd - 1.5371385940 * yd - 0.4985314096 * zd
    const lg = -0.9692660305 * xd + 1.8760108454 * yd + 0.0415560175 * zd
    const lb =  0.0556434309 * xd - 0.2040259135 * yd + 1.0572251882 * zd

    return [
        Math.round(clamp(linearToSrgb(lr), 0, 1) * 255),
        Math.round(clamp(linearToSrgb(lg), 0, 1) * 255),
        Math.round(clamp(linearToSrgb(lb), 0, 1) * 255),
    ]
}

/** Linear sRGB → sRGB gamma correction */
function linearToSrgb(v: number): number {
    if (v <= 0.0031308) return 12.92 * v
    return 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

// --- Helpers ---

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v))
}

function expandHex(hex: string): string {
    const h = hex.slice(1)
    if (h.length === 3) return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    if (h.length === 4) return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
    return hex
}

function rgbToColor(r: number, g: number, b: number): string {
    // Computed colours (rgb(), hsl(), oklch(), …) stay truecolor like hex —
    // only keywords map to themeable ANSI names.
    return '#' + toHex(r) + toHex(g) + toHex(b)
}

function toHex(n: number): string {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

// --- ANSI colours ---

const ANSI_COLORS: Record<string, string> = {
    black: 'black', red: 'red', green: 'green', yellow: 'yellow',
    blue: 'blue', magenta: 'magenta', cyan: 'cyan', white: 'white',
}

// --- CSS named colours (all 148) ---

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
