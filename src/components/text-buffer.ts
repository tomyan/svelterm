import type { KeyEvent } from '../input/keyboard.js'

export class TextBuffer {
    private _text: string
    private _cursor: number

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
        this._text = this._text.substring(0, this._cursor) + chars + this._text.substring(this._cursor)
        this._cursor += chars.length
    }

    delete(): void {
        if (this._cursor >= this._text.length) return
        this._text = this._text.substring(0, this._cursor) + this._text.substring(this._cursor + 1)
    }

    backspace(): void {
        if (this._cursor <= 0) return
        this._text = this._text.substring(0, this._cursor - 1) + this._text.substring(this._cursor)
        this._cursor--
    }

    moveLeft(): void { this.cursor-- }
    moveRight(): void { this.cursor++ }
    home(): void { this._cursor = 0 }
    end(): void { this._cursor = this._text.length }

    clearToStart(): void {
        this._text = this._text.substring(this._cursor)
        this._cursor = 0
    }

    clearToEnd(): void {
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
