function decodeBytes(data: Buffer | Uint8Array): string {
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) return data.toString()
    return new TextDecoder().decode(data)
}

export interface KeyEvent {
    key: string
    ctrl: boolean
    shift: boolean
    meta: boolean
}

const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'

/** Check if data contains a bracketed paste sequence. Returns the pasted text or null. */
export function parsePaste(data: Buffer | Uint8Array): string | null {
    const str = decodeBytes(data)
    if (str.startsWith(PASTE_START)) {
        const endIdx = str.indexOf(PASTE_END)
        if (endIdx !== -1) {
            return str.substring(PASTE_START.length, endIdx)
        }
        // Paste without end marker — take everything after start
        return str.substring(PASTE_START.length)
    }
    return null
}

export function parseKeyEvent(data: Buffer | Uint8Array): KeyEvent | null {
    if (data.length === 0) return null

    const byte = data[0]

    // Ctrl+key (0x01-0x1a, except Tab/Enter/Escape)
    if (byte >= 0x01 && byte <= 0x1a) {
        if (byte === 0x09) return { key: 'Tab', ctrl: false, shift: false, meta: false }
        if (byte === 0x0d) return { key: 'Enter', ctrl: false, shift: false, meta: false }
        if (byte === 0x1b) return parseEscapeSequence(data)
        const letter = String.fromCharCode(byte + 0x60) // 0x01 -> 'a'
        return { key: letter, ctrl: true, shift: false, meta: false }
    }

    // Backspace
    if (byte === 0x7f) return { key: 'Backspace', ctrl: false, shift: false, meta: false }

    // Escape sequence
    if (byte === 0x1b) return parseEscapeSequence(data)

    // Regular printable character
    if (byte >= 0x20 && byte <= 0x7e) {
        return { key: String.fromCharCode(byte), ctrl: false, shift: false, meta: false }
    }

    return null
}

function parseEscapeSequence(data: Buffer | Uint8Array): KeyEvent {
    // Bare escape
    if (data.length === 1) {
        return { key: 'Escape', ctrl: false, shift: false, meta: false }
    }

    // CSI sequences: ESC [
    if (data[1] === 0x5b) {
        return parseCSI(data)
    }

    return { key: 'Escape', ctrl: false, shift: false, meta: false }
}

function parseCSI(data: Buffer | Uint8Array): KeyEvent {
    const base = { ctrl: false, shift: false, meta: false }

    if (data.length < 3) return { key: 'Escape', ...base }

    const third = data[2]

    // Arrow keys: ESC [ A/B/C/D
    switch (third) {
        case 0x41: return { key: 'ArrowUp', ...base }
        case 0x42: return { key: 'ArrowDown', ...base }
        case 0x43: return { key: 'ArrowRight', ...base }
        case 0x44: return { key: 'ArrowLeft', ...base }
        case 0x48: return { key: 'Home', ...base }
        case 0x46: return { key: 'End', ...base }
        case 0x5a: return { key: 'Tab', ctrl: false, shift: true, meta: false } // Shift+Tab (Back Tab)
    }

    // Extended keys: ESC [ N ~
    if (data.length >= 4 && data[3] === 0x7e) {
        switch (third) {
            case 0x32: return { key: 'Insert', ...base }
            case 0x33: return { key: 'Delete', ...base }
            case 0x35: return { key: 'PageUp', ...base }
            case 0x36: return { key: 'PageDown', ...base }
        }
    }

    // Modified keys: ESC [ 1 ; modifier X (e.g. Shift+Arrow)
    if (data.length >= 6 && third === 0x31 && data[3] === 0x3b) {
        const modifier = data[4] - 0x30
        const keyCode = data[5]
        const mods = parseModifier(modifier)
        const keyName = CSI_KEYS[keyCode]
        if (keyName) return { key: keyName, ...mods }
    }

    return { key: 'Escape', ...base }
}

const CSI_KEYS: Record<number, string> = {
    0x41: 'ArrowUp', 0x42: 'ArrowDown', 0x43: 'ArrowRight', 0x44: 'ArrowLeft',
    0x48: 'Home', 0x46: 'End',
}

function parseModifier(mod: number): { ctrl: boolean; shift: boolean; meta: boolean } {
    // CSI modifier values: 1=none, 2=Shift, 3=Alt, 4=Shift+Alt, 5=Ctrl, 6=Shift+Ctrl, 7=Alt+Ctrl, 8=Shift+Alt+Ctrl
    return {
        shift: (mod & 1) !== 0,
        meta: (mod & 2) !== 0,
        ctrl: (mod & 4) !== 0,
    }
}
