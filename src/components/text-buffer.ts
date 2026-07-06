import type { KeyEvent } from '../input/keyboard.js'
import { nextGraphemeBoundary, prevGraphemeBoundary } from '../layout/unicode.js'
import { handleBufferKey } from './text-buffer-keymap.js'

function isSpace(ch: string): boolean {
    return /\s/.test(ch)
}

export class TextBuffer {
    private _text: string
    private _cursor: number
    private _anchor: number | null = null
    private _clipboard: string | null = null
    /** Insertion cap in code units, as HTML maxlength counts them. */
    maxLength: number | null = null
    /** Blocks all mutation while leaving caret movement live. */
    readOnly = false

    constructor(initial: string = '') {
        this._text = initial
        this._cursor = initial.length
    }

    get text(): string { return this._text }
    set text(value: string) { this._text = value }

    get cursor(): number { return this._cursor }
    set cursor(value: number) {
        this._cursor = Math.max(0, Math.min(value, this._text.length))
    }

    insert(chars: string): void {
        if (this.readOnly) return
        this.deleteSelection()
        if (this.maxLength !== null) {
            const room = Math.max(0, this.maxLength - this._text.length)
            chars = chars.slice(0, room)
        }
        if (chars.length === 0) return
        this._text = this._text.substring(0, this._cursor) + chars + this._text.substring(this._cursor)
        this._cursor += chars.length
    }

    delete(): void {
        if (this.readOnly) return
        if (this.deleteSelection()) return
        if (this._cursor >= this._text.length) return
        const end = nextGraphemeBoundary(this._text, this._cursor)
        this._text = this._text.substring(0, this._cursor) + this._text.substring(end)
    }

    backspace(): void {
        if (this.readOnly) return
        if (this.deleteSelection()) return
        if (this._cursor <= 0) return
        const start = prevGraphemeBoundary(this._text, this._cursor)
        this._text = this._text.substring(0, start) + this._text.substring(this._cursor)
        this._cursor = start
    }

    moveLeft(): void { this._cursor = prevGraphemeBoundary(this._text, this._cursor) }
    moveRight(): void { this._cursor = nextGraphemeBoundary(this._text, this._cursor) }
    home(): void { this._cursor = 0 }
    end(): void { this._cursor = this._text.length }

    wordLeft(): void { this._cursor = this.scanWordLeft(this._cursor) }
    wordRight(): void { this._cursor = this.scanWordRight(this._cursor) }

    deleteWordLeft(): void {
        if (this.readOnly) return
        if (this.deleteSelection()) return
        const start = this.scanWordLeft(this._cursor)
        this._text = this._text.substring(0, start) + this._text.substring(this._cursor)
        this._cursor = start
    }

    deleteWordRight(): void {
        if (this.readOnly) return
        if (this.deleteSelection()) return
        const end = this.scanWordRight(this._cursor)
        this._text = this._text.substring(0, this._cursor) + this._text.substring(end)
    }

    clearToStart(): void {
        if (this.readOnly) return
        this.collapseSelection()
        this._text = this._text.substring(this._cursor)
        this._cursor = 0
    }

    clearToEnd(): void {
        if (this.readOnly) return
        this.collapseSelection()
        this._text = this._text.substring(0, this._cursor)
    }

    // --- Selection ---

    /** Code-unit range [start, end), or null when nothing is selected. */
    selectionRange(): { start: number; end: number } | null {
        if (this._anchor === null || this._anchor === this._cursor) return null
        return {
            start: Math.min(this._anchor, this._cursor),
            end: Math.max(this._anchor, this._cursor),
        }
    }

    selectedText(): string {
        const range = this.selectionRange()
        return range ? this._text.substring(range.start, range.end) : ''
    }

    /** Anchor the selection at the cursor unless one is already growing. */
    beginExtend(): void {
        if (this._anchor === null) this._anchor = this._cursor
    }

    collapseSelection(): void { this._anchor = null }

    /** Select the whitespace-delimited word around a code-unit offset. */
    selectWordAt(offset: number): void {
        if (this._text.length === 0) return
        const at = Math.max(0, Math.min(offset, this._text.length - 1))
        if (isSpace(this._text[at])) return
        let start = at
        while (start > 0 && !isSpace(this._text[start - 1])) start--
        let end = at
        while (end < this._text.length && !isSpace(this._text[end])) end++
        this._anchor = start
        this._cursor = end
    }

    /** Copy the selection for the clipboard; the selection stays. */
    copySelection(): boolean {
        const text = this.selectedText()
        if (text === '') return false
        this._clipboard = text
        return true
    }

    /** Cut the selection for the clipboard. */
    cutSelection(): boolean {
        if (this.readOnly) return false
        if (!this.copySelection()) return false
        this.deleteSelection()
        return true
    }

    /** Text parked by cut/copy, handed over once for the clipboard write. */
    drainClipboardText(): string | null {
        const text = this._clipboard
        this._clipboard = null
        return text
    }

    private deleteSelection(): boolean {
        const range = this.selectionRange()
        this._anchor = null
        if (!range) return false
        this._text = this._text.substring(0, range.start) + this._text.substring(range.end)
        this._cursor = range.start
        return true
    }

    handleKey(key: KeyEvent): boolean {
        return handleBufferKey(this, key)
    }

    /** Words are whitespace-delimited: skip spaces, then the word. The
     *  result lands beside whitespace or at an end of the text, both of
     *  which are grapheme boundaries, so code-unit scanning is safe. */
    private scanWordLeft(from: number): number {
        let i = from
        while (i > 0 && isSpace(this._text[i - 1])) i--
        while (i > 0 && !isSpace(this._text[i - 1])) i--
        return i
    }

    private scanWordRight(from: number): number {
        let i = from
        while (i < this._text.length && isSpace(this._text[i])) i++
        while (i < this._text.length && !isSpace(this._text[i])) i++
        return i
    }
}
