/**
 * Key/mouse event encoding — the inverse of keyboard.ts/mouse.ts,
 * mirroring sumi's runtime/input/encode.go. The debug protocol's Input
 * domain encodes semantic specs to the same bytes a terminal would
 * send, so injected events exercise the real parsers.
 */

export interface KeySpec {
    key: string
    ctrl?: boolean
    shift?: boolean
    meta?: boolean
}

export interface MouseSpec {
    type: 'press' | 'release' | 'motion' | 'scroll'
    x: number // 0-based cell column
    y: number // 0-based cell row
    button?: 'left' | 'middle' | 'right' | 'scrollUp' | 'scrollDown'
}

/** Specials that encode as a single byte (modifiers cannot attach). */
const BARE_SPECIALS: Record<string, string> = {
    Enter: '\r', Tab: '\t', Escape: '\x1b', Backspace: '\x7f',
}

/** Specials that encode as fixed CSI sequences. */
const CSI_SPECIALS: Record<string, string> = {
    Delete: '\x1b[3~', PageUp: '\x1b[5~', PageDown: '\x1b[6~',
}

/** CSI final letters for keys that take the `CSI 1;mod X` modified form. */
const MODIFIABLE_FINALS: Record<string, string> = {
    ArrowUp: 'A', ArrowDown: 'B', ArrowRight: 'C', ArrowLeft: 'D',
    Home: 'H', End: 'F',
}

/** Encode a key chord as the byte sequence a terminal would send. */
export function encodeKey(spec: KeySpec): string {
    // Modifiable CSI keys take modifiers in the `CSI 1;mod` form —
    // including Alt, which never uses the ESC prefix on these.
    const final = MODIFIABLE_FINALS[spec.key]
    if (final) {
        if (!spec.ctrl && !spec.shift && !spec.meta) return `\x1b[${final}`
        const mod = 1 + (spec.shift ? 1 : 0) + (spec.meta ? 2 : 0) + (spec.ctrl ? 4 : 0)
        return `\x1b[1;${mod}${final}`
    }

    if (spec.meta) {
        // Alt sends ESC followed by the unmodified key's bytes
        return '\x1b' + encodeKey({ ...spec, meta: false })
    }

    if (spec.key === 'Tab' && spec.shift) return '\x1b[Z'
    const bare = BARE_SPECIALS[spec.key]
    if (bare) return bare
    const csi = CSI_SPECIALS[spec.key]
    if (csi) return csi

    if (spec.key.length === 1) {
        if (spec.ctrl) return encodeCtrlChar(spec.key)
        return spec.key
    }

    throw new Error(`Cannot encode key: ${spec.key}`)
}

function encodeCtrlChar(ch: string): string {
    if (ch === '_') return '\x1f'
    const code = ch.toLowerCase().charCodeAt(0)
    if (code >= 0x61 && code <= 0x7a) return String.fromCharCode(code - 0x60)
    throw new Error(`Cannot encode Ctrl+${ch}`)
}

const BUTTON_CODES: Record<string, number> = {
    left: 0, middle: 1, right: 2, scrollUp: 64, scrollDown: 65,
}

/** Encode a mouse event as an SGR sequence (wire coords are 1-based). */
export function encodeMouse(spec: MouseSpec): string {
    let code = BUTTON_CODES[spec.button ?? (spec.type === 'scroll' ? 'scrollUp' : 'left')]
    if (code === undefined) throw new Error(`Cannot encode mouse button: ${spec.button}`)
    if (spec.type === 'motion') code |= 32
    const suffix = spec.type === 'release' ? 'm' : 'M'
    return `\x1b[<${code};${spec.x + 1};${spec.y + 1}${suffix}`
}
