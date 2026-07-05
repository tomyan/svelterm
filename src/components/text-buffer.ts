import type { KeyEvent } from '../input/keyboard.js'
import { nextGraphemeBoundary, prevGraphemeBoundary } from '../layout/unicode.js'

export class TextBuffer {
    private _text: string
    private _cursor: number
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
        if (this._cursor >= this._text.length) return
        const end = nextGraphemeBoundary(this._text, this._cursor)
        this._text = this._text.substring(0, this._cursor) + this._text.substring(end)
    }

    backspace(): void {
        if (this.readOnly) return
        if (this._cursor <= 0) return
        const start = prevGraphemeBoundary(this._text, this._cursor)
        this._text = this._text.substring(0, start) + this._text.substring(this._cursor)
        this._cursor = start
    }

    moveLeft(): void { this._cursor = prevGraphemeBoundary(this._text, this._cursor) }
    moveRight(): void { this._cursor = nextGraphemeBoundary(this._text, this._cursor) }
    home(): void { this._cursor = 0 }
    end(): void { this._cursor = this._text.length }

    clearToStart(): void {
        if (this.readOnly) return
        this._text = this._text.substring(this._cursor)
        this._cursor = 0
    }

    clearToEnd(): void {
        if (this.readOnly) return
        this._text = this._text.substring(0, this._cursor)
    }

    handleKey(key: KeyEvent): boolean {
        if (key.ctrl) return this.handleCtrl(key.key)

        switch (key.key) {
            case 'Backspace': this.backspace(); return true
            case 'Delete': this.delete(); return true
            case 'ArrowLeft': this.moveLeft(); return true
            case 'ArrowRight': this.moveRight(); return true
            case 'Home': this.home(); return true
            case 'End': this.end(); return true
            default:
                if (key.key.length === 1) {
                    this.insert(key.key)
                    return true
                }
                return false
        }
    }

    private handleCtrl(key: string): boolean {
        switch (key) {
            case 'a': this.home(); return true
            case 'e': this.end(); return true
            case 'u': this.clearToStart(); return true
            case 'k': this.clearToEnd(); return true
            default: return false
        }
    }
}
