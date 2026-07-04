/**
 * Grapheme segmentation and terminal cell widths. Terminals allot two
 * columns to East Asian wide/fullwidth characters and (by modern
 * convention) emoji; combining marks ride their base; a handful of
 * characters occupy no column at all.
 */

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** Split into user-perceived characters (grapheme clusters). */
export function graphemes(text: string): string[] {
    if (text === '') return []
    const out: string[] = []
    for (const segment of segmenter.segment(text)) out.push(segment.segment)
    return out
}

/**
 * East Asian wide/fullwidth ranges plus wide-rendering emoji blocks.
 * Compact interval table over code points; derived from UAX #11 and the
 * ranges terminals treat as wide in practice.
 */
const WIDE_RANGES: Array<[number, number]> = [
    [0x1100, 0x115f],   // Hangul Jamo leading consonants
    [0x2e80, 0x303e],   // CJK Radicals … CJK Symbols and Punctuation
    [0x3041, 0x33ff],   // Hiragana … CJK Compatibility
    [0x3400, 0x4dbf],   // CJK Extension A
    [0x4e00, 0x9fff],   // CJK Unified Ideographs
    [0xa000, 0xa4cf],   // Yi
    [0xa960, 0xa97f],   // Hangul Jamo Extended-A
    [0xac00, 0xd7a3],   // Hangul Syllables
    [0xf900, 0xfaff],   // CJK Compatibility Ideographs
    [0xfe10, 0xfe19],   // Vertical forms
    [0xfe30, 0xfe6f],   // CJK Compatibility Forms, Small Form Variants
    [0xff00, 0xff60],   // Fullwidth Forms
    [0xffe0, 0xffe6],   // Fullwidth signs
    [0x1f004, 0x1f004], // Mahjong red dragon
    [0x1f0cf, 0x1f0cf], // Playing card joker
    [0x1f18e, 0x1f18e], // AB button
    [0x1f191, 0x1f19a], // Squared CL … VS
    [0x1f200, 0x1f2ff], // Enclosed ideographic supplement
    [0x1f300, 0x1f64f], // Misc symbols & pictographs, emoticons
    [0x1f680, 0x1f6ff], // Transport & map symbols
    [0x1f900, 0x1f9ff], // Supplemental symbols & pictographs
    [0x1fa70, 0x1faff], // Symbols & pictographs extended-A
    [0x20000, 0x2fffd], // CJK Extension B …
    [0x30000, 0x3fffd], // CJK Extension G …
]

/** Zero-column code points: combining marks handled via category check. */
const ZERO_WIDTH = new Set([
    0x200b, // zero width space
    0x200c, // zero width non-joiner
    0x200d, // zero width joiner
    0xfeff, // BOM / zero width no-break space
])

const COMBINING_RE = /\p{Mn}|\p{Me}/u

function codePointWidth(cp: number): number {
    if (ZERO_WIDTH.has(cp)) return 0
    const char = String.fromCodePoint(cp)
    if (COMBINING_RE.test(char)) return 0
    for (const [start, end] of WIDE_RANGES) {
        if (cp >= start && cp <= end) return 2
        if (cp < start) break
    }
    return 1
}

/**
 * The cell width of one grapheme cluster: the max of its code points'
 * widths — a ZWJ emoji sequence is as wide as its widest member, a
 * combining sequence as wide as its base.
 */
export function charWidth(grapheme: string): number {
    let width = 0
    for (const char of grapheme) {
        width = Math.max(width, codePointWidth(char.codePointAt(0)!))
    }
    return width
}

/** The code-unit index of the grapheme boundary after `index`. */
export function nextGraphemeBoundary(text: string, index: number): number {
    if (index >= text.length) return text.length
    for (const segment of segmenter.segment(text)) {
        const end = segment.index + segment.segment.length
        if (end > index) return end
    }
    return text.length
}

/** The code-unit index of the grapheme boundary before `index`. */
export function prevGraphemeBoundary(text: string, index: number): number {
    if (index <= 0) return 0
    let previous = 0
    for (const segment of segmenter.segment(text)) {
        if (segment.index >= index) break
        previous = segment.index
    }
    return previous
}

/** The total cell width of a string. */
export function stringWidth(text: string): number {
    // Fast path: ASCII (the overwhelmingly common case)
    let ascii = true
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) > 0x7e) { ascii = false; break }
    }
    if (ascii) return text.length
    let width = 0
    for (const grapheme of graphemes(text)) width += charWidth(grapheme)
    return width
}
