export interface KeyEvent {
    key: string
    ctrl: boolean
    shift: boolean
    meta: boolean
}

export function parseKeyEvent(data: Buffer): KeyEvent | null {
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

function parseEscapeSequence(data: Buffer): KeyEvent {
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

function parseCSI(data: Buffer): KeyEvent {
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

    return { key: 'Escape', ...base }
}
