import type { KeyEvent } from '../input/keyboard.js'
import { nextGraphemeBoundary, prevGraphemeBoundary } from '../layout/unicode.js'
import { handleBufferKey } from './text-buffer-keymap.js'
import { KillRing } from './kill-ring.js'

function isSpace(ch: string): boolean {
    return /\s/.test(ch)
}

/** Point-in-time editing state for undo/redo, as in sumi's snapshot. */
interface Snapshot {
    value: string
    cursor: number
}

export class TextBuffer {
    private _text: string
    private _cursor: number
    private _anchor: number | null = null
    private _clipboard: string | null = null
    private killRing = new KillRing()
    private _lastYank = false
    private _lastYankLength = 0
    private undoStack: Snapshot[] = []
    private redoStack: Snapshot[] = []
    /** Insertion cap in code units, as HTML maxlength counts them. */
    maxLength: number | null = null
    /** Blocks all mutation while leaving caret movement live. */
    readOnly = false
    /** Line-aware editing (textarea): Enter inserts, Up/Down move lines. */
    multiline = false

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

    /** Inserts at the cursor, replacing any selection. Returns the code
     *  units actually inserted (maxLength may truncate). */
    insert(chars: string): number {
        if (this.readOnly) return 0
        return this.recordUndo(() => this.rawInsert(chars))
    }

    /** Insert without an undo entry — yank-pop swaps text outside undo. */
    private rawInsert(chars: string): number {
        this.deleteSelection()
        this._lastYank = false
        if (this.maxLength !== null) {
            const room = Math.max(0, this.maxLength - this._text.length)
            chars = chars.slice(0, room)
        }
        if (chars.length === 0) return 0
        this._text = this._text.substring(0, this._cursor) + chars + this._text.substring(this._cursor)
        this._cursor += chars.length
        return chars.length
    }

    delete(): void {
        if (this.readOnly) return
        this.recordUndo(() => {
            if (this.deleteSelection()) return
            if (this._cursor >= this._text.length) return
            const end = nextGraphemeBoundary(this._text, this._cursor)
            this._text = this._text.substring(0, this._cursor) + this._text.substring(end)
        })
    }

    backspace(): void {
        if (this.readOnly) return
        this.recordUndo(() => {
            if (this.deleteSelection()) return
            if (this._cursor <= 0) return
            const start = prevGraphemeBoundary(this._text, this._cursor)
            this._text = this._text.substring(0, start) + this._text.substring(this._cursor)
            this._cursor = start
        })
    }

    moveLeft(): void { this._lastYank = false; this._cursor = prevGraphemeBoundary(this._text, this._cursor) }
    moveRight(): void { this._lastYank = false; this._cursor = nextGraphemeBoundary(this._text, this._cursor) }
    home(): void { this._lastYank = false; this._cursor = 0 }
    end(): void { this._lastYank = false; this._cursor = this._text.length }

    wordLeft(): void { this._lastYank = false; this._cursor = this.scanWordLeft(this._cursor) }
    wordRight(): void { this._lastYank = false; this._cursor = this.scanWordRight(this._cursor) }

    // --- Lines (sumi multiline.go) ---

    /** The cursor's { row, col } within the value's lines, in code units. */
    lineCol(): { row: number; col: number } {
        let col = this._cursor
        let row = 0
        for (const line of this._text.split('\n')) {
            if (col <= line.length) return { row, col }
            col -= line.length + 1 // the newline
            row++
        }
        return { row, col: 0 }
    }

    /** Move one line up, keeping the column where the target line allows. */
    cursorUp(): void { this.moveLine(-1) }

    /** Move one line down, keeping the column where the target line allows. */
    cursorDown(): void { this.moveLine(1) }

    private moveLine(delta: number): void {
        const lines = this._text.split('\n')
        const { row, col } = this.lineCol()
        const target = row + delta
        if (target < 0 || target >= lines.length) return
        const clamped = Math.min(col, lines[target].length)
        let cursor = 0
        for (let i = 0; i < target; i++) cursor += lines[i].length + 1
        this._cursor = cursor + clamped
        this._lastYank = false
    }

    // --- Kills (deleted text lands on the kill ring) ---

    killWordLeft(): void {
        if (this.readOnly) return
        this.recordUndo(() => {
            if (this.deleteSelection()) return
            const start = this.scanWordLeft(this._cursor)
            this.killRing.push(this._text.substring(start, this._cursor))
            this._lastYank = false
            this._text = this._text.substring(0, start) + this._text.substring(this._cursor)
            this._cursor = start
        })
    }

    killWordRight(): void {
        if (this.readOnly) return
        this.recordUndo(() => {
            if (this.deleteSelection()) return
            const end = this.scanWordRight(this._cursor)
            this.killRing.push(this._text.substring(this._cursor, end))
            this._lastYank = false
            this._text = this._text.substring(0, this._cursor) + this._text.substring(end)
        })
    }

    killToStart(): void {
        if (this.readOnly) return
        this.recordUndo(() => {
            this.collapseSelection()
            this.killRing.push(this._text.substring(0, this._cursor))
            this._lastYank = false
            this._text = this._text.substring(this._cursor)
            this._cursor = 0
        })
    }

    killToEnd(): void {
        if (this.readOnly) return
        this.recordUndo(() => {
            this.collapseSelection()
            this.killRing.push(this._text.substring(this._cursor))
            this._lastYank = false
            this._text = this._text.substring(0, this._cursor)
        })
    }

    // --- Yank ---

    /** Insert the most recent kill at the cursor (Ctrl+Y). */
    yank(): void {
        if (this.readOnly) return
        const text = this.killRing.current()
        if (text === null) return
        const inserted = this.insert(text)
        this._lastYank = true
        this._lastYankLength = inserted
    }

    /** Replace a just-yanked text with the previous kill (Alt+Y). The swap
     *  happens outside undo, as in sumi — undo steps over the whole yank. */
    yankPop(): void {
        if (this.readOnly) return
        if (!this._lastYank || this.killRing.size < 2) return
        const start = Math.max(0, this._cursor - this._lastYankLength)
        this._text = this._text.substring(0, start) + this._text.substring(this._cursor)
        this._cursor = start
        const inserted = this.rawInsert(this.killRing.cyclePrev()!)
        this._lastYank = true
        this._lastYankLength = inserted
    }

    /** Swap the graphemes around the cursor (Ctrl+T); at the end, the two before it. */
    transposeChars(): void {
        if (this.readOnly) return
        this.recordUndo(() => {
            this._lastYank = false
            const len = this._text.length
            const pos = this._cursor >= len ? prevGraphemeBoundary(this._text, len) : this._cursor
            if (pos < 1) return
            const aStart = prevGraphemeBoundary(this._text, pos)
            const bEnd = nextGraphemeBoundary(this._text, pos)
            const a = this._text.substring(aStart, pos)
            const b = this._text.substring(pos, bEnd)
            this._text = this._text.substring(0, aStart) + b + a + this._text.substring(bEnd)
            this._cursor = aStart + b.length + a.length
        })
    }

    // --- Undo / Redo ---

    /** Revert to the state before the last mutation (Ctrl+_). */
    undo(): void {
        if (this.readOnly) return
        const prev = this.undoStack.pop()
        if (!prev) return
        this.redoStack.push({ value: this._text, cursor: this._cursor })
        this.restore(prev)
    }

    /** Reapply the last undone change. Unbound, as in sumi — readline has
     *  no redo chord (Ctrl+Y is yank); provided for programmatic use. */
    redo(): void {
        if (this.readOnly) return
        const next = this.redoStack.pop()
        if (!next) return
        this.undoStack.push({ value: this._text, cursor: this._cursor })
        this.restore(next)
    }

    private restore(snapshot: Snapshot): void {
        this._text = snapshot.value
        this._cursor = snapshot.cursor
        this._anchor = null
        this._lastYank = false
    }

    /** Run a mutation, pushing the pre-state onto the undo stack when the
     *  text actually changed (cursor-only moves never create entries). */
    private recordUndo<T>(fn: () => T): T {
        const value = this._text
        const cursor = this._cursor
        const result = fn()
        if (this._text !== value) {
            this.undoStack.push({ value, cursor })
            this.redoStack = []
        }
        return result
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
        this._lastYank = false
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

    /** Cut the selection for the clipboard and the kill ring. */
    cutSelection(): boolean {
        if (this.readOnly) return false
        if (!this.copySelection()) return false
        this.killRing.push(this.selectedText())
        this.recordUndo(() => this.deleteSelection())
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
        this._lastYank = false
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
