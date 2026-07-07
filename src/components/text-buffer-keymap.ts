/**
 * Chord routing for TextBuffer, mirroring sumi's edit/keymap.go readline
 * bindings plus browser-style shift+movement selection. Returns true when
 * the event was consumed; Tab/Enter/Escape and unbound chords are left
 * for the caller.
 */

import type { KeyEvent } from '../input/keyboard.js'
import type { TextBuffer } from './text-buffer.js'

const MOVEMENT_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

export function handleBufferKey(buf: TextBuffer, key: KeyEvent): boolean {
    if (MOVEMENT_KEYS.has(key.key)) return handleMovement(buf, key)
    if (key.ctrl) return handleCtrl(buf, key.key)
    if (key.meta) return handleMeta(buf, key.key)

    switch (key.key) {
        case 'Backspace': buf.backspace(); return true
        case 'Delete': buf.delete(); return true
        case 'Enter':
            // Multiline (textarea): newline; consumed-but-inert when
            // readOnly, as in sumi. Single-line leaves Enter to the app.
            if (!buf.multiline) return false
            buf.insert('\n')
            return true
        default:
            if (key.key.length === 1) {
                buf.insert(key.key)
                return true
            }
            return false
    }
}

/** Shift extends the selection; Ctrl/Alt move by word. */
function handleMovement(buf: TextBuffer, key: KeyEvent): boolean {
    // Up/Down are line movement — only multiline buffers own them
    if ((key.key === 'ArrowUp' || key.key === 'ArrowDown') && !buf.multiline) return false
    if (key.shift) buf.beginExtend()
    else buf.collapseSelection()
    const byWord = key.ctrl || key.meta
    switch (key.key) {
        case 'ArrowLeft': byWord ? buf.wordLeft() : buf.moveLeft(); break
        case 'ArrowRight': byWord ? buf.wordRight() : buf.moveRight(); break
        case 'ArrowUp': buf.cursorUp(); break
        case 'ArrowDown': buf.cursorDown(); break
        case 'Home': buf.home(); break
        case 'End': buf.end(); break
    }
    return true
}

function handleCtrl(buf: TextBuffer, key: string): boolean {
    switch (key) {
        case 'a': buf.collapseSelection(); buf.home(); return true
        case 'e': buf.collapseSelection(); buf.end(); return true
        case 'b': buf.collapseSelection(); buf.moveLeft(); return true
        case 'f': buf.collapseSelection(); buf.moveRight(); return true
        case 'h': buf.backspace(); return true
        case 'd': buf.delete(); return true
        case 'u': buf.killToStart(); return true
        case 'k': buf.killToEnd(); return true
        case 't': buf.transposeChars(); return true
        case 'y': buf.yank(); return true
        case '_': buf.undo(); return true
        case 'w':
            if (!buf.cutSelection()) buf.killWordLeft()
            return true
        default: return false
    }
}

function handleMeta(buf: TextBuffer, key: string): boolean {
    switch (key) {
        case 'b': buf.collapseSelection(); buf.wordLeft(); return true
        case 'f': buf.collapseSelection(); buf.wordRight(); return true
        case 'd': buf.killWordRight(); return true
        case 'y': buf.yankPop(); return true
        case 'w': buf.copySelection(); return true
        case 'Backspace': buf.killWordLeft(); return true
        default: return false
    }
}
