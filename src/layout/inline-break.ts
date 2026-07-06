/**
 * Line breaking for an inline formatting context: collapses whitespace
 * across the item sequence (white-space: normal), splits it into
 * unbreakable words that may span item boundaries, and flows the words
 * into lines. Widths are cell widths over graphemes.
 */
import { graphemes, charWidth } from './unicode.js'

/** One line-rectangle of an inline run, in IFC content coordinates. */
export interface BrokenFragment {
    x: number
    y: number
    width: number
    text: string
}

interface Unit { g: string; w: number }

export interface TextItem { kind: 'text'; units: Unit[]; breakAll: boolean }
export interface AtomItem { kind: 'atom'; width: number; height: number }
export type InlineItem = TextItem | AtomItem

export type InlineAlign = 'left' | 'center' | 'right'

export interface BrokenRun {
    /** Fragments per item, index-aligned with the input items. */
    perItem: BrokenFragment[][]
    /** Natural width: the widest line before alignment shifts. */
    width: number
    /** Total height: the sum of line heights. */
    height: number
}

export function textItem(text: string, breakAll = false): TextItem {
    const units = graphemes(text).map(g => ({ g, w: Math.max(1, charWidth(g)) }))
    return { kind: 'text', units, breakAll }
}

/** A word segment owned by a single item — words can span item
 * boundaries ("foo<strong>bar</strong>" is one word), and each item's
 * part becomes its own fragment. */
interface InlineSegment { item: number; units: Unit[] }

/** An unbreakable unit: a text word's segments, or an atom, plus the
 * item owning the collapsed space before it (-1 when none). */
interface InlineWord {
    segs: InlineSegment[]
    preSpace: number
    atom: number // item index of an atom word; -1 for text words
    atomW: number
    atomH: number
}

function wordWidth(word: InlineWord): number {
    if (word.atom >= 0) return word.atomW
    let w = 0
    for (const seg of word.segs) for (const unit of seg.units) w += unit.w
    return w
}

function isInlineSpace(g: string): boolean {
    return g === ' ' || g === '\t' || g === '\n' || g === '\r'
}

/** Collapses whitespace across the item sequence and splits it into
 * words; atoms are words of their own. A whitespace gap belongs to the
 * item where it first appears; a leading gap is dropped. break-all
 * items yield single-grapheme words so lines may break anywhere. */
function tokenizeInline(items: InlineItem[]): InlineWord[] {
    const t = new Tokenizer()
    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        if (item.kind === 'atom') {
            t.closeWord()
            t.startWord()
            t.current.atom = idx
            t.current.atomW = item.width
            t.current.atomH = item.height
            t.closeWord()
            continue
        }
        for (const unit of item.units) {
            if (isInlineSpace(unit.g)) {
                t.closeWord()
                if (t.pendingSpace < 0) t.pendingSpace = idx
                continue
            }
            t.startWord()
            t.appendUnit(idx, unit)
            if (item.breakAll) t.closeWord()
        }
    }
    t.closeWord()
    return t.words
}

class Tokenizer {
    words: InlineWord[] = []
    current: InlineWord = emptyWord()
    pendingSpace = -1
    private open = false

    /** Claims any pending space for the word about to be built. A
     * leading gap (nothing before it in the flow) is dropped. */
    startWord(): void {
        if (this.open) return
        this.open = true
        if (this.pendingSpace >= 0) {
            if (this.words.length > 0) this.current.preSpace = this.pendingSpace
            this.pendingSpace = -1
        }
    }

    closeWord(): void {
        if (this.current.atom >= 0 || this.current.segs.length > 0) {
            this.words.push(this.current)
        }
        this.current = emptyWord()
        this.open = false
    }

    /** Adds a unit to the word, starting a new segment when the owning
     * item changes. */
    appendUnit(item: number, unit: Unit): void {
        const last = this.current.segs[this.current.segs.length - 1]
        if (!last || last.item !== item) {
            this.current.segs.push({ item, units: [unit] })
        } else {
            last.units.push(unit)
        }
    }
}

function emptyWord(): InlineWord {
    return { segs: [], preSpace: -1, atom: -1, atomW: 0, atomH: 0 }
}

/** Flows the items into lines of availW cells and returns each item's
 * fragments in IFC content coordinates (atoms get one empty-text
 * fragment marking their slot). Soft breaks happen at collapsed spaces
 * (the breaking space is consumed); words wider than a line hard-break
 * at the width; atoms are unbreakable. Line heights follow the tallest
 * item on each line; text-align shifts whole lines within availW. */
export function breakInline(items: InlineItem[], availW: number, align: InlineAlign): BrokenRun {
    // Zero/negative available width means "no meaningful constraint":
    // flow on one unwrapped line (same convention as the block text path).
    const flow = new LineFlow(availW > 0 ? availW : Infinity, align, items.length)
    for (const word of tokenizeInline(items)) {
        flow.placeWord(word)
    }
    return flow.resolveLines()
}

/** Tracks the fill cursor while words are placed onto lines. Fragment y
 * values hold line indices until resolveLines rewrites them to row
 * offsets using the accumulated line heights. */
class LineFlow {
    private cursorX = 0
    private line = 0
    private lineHeights = [0]
    private lineWidths: number[] = []
    readonly perItem: BrokenFragment[][]

    constructor(
        private readonly availW: number,
        private readonly align: InlineAlign,
        itemCount: number,
    ) {
        this.perItem = Array.from({ length: itemCount }, () => [])
    }

    /** Soft-wraps to the next line when the word (plus its leading
     * space) does not fit, then emits the space and the word. */
    placeWord(word: InlineWord): void {
        const spaceW = word.preSpace >= 0 && this.cursorX > 0 ? 1 : 0
        if (this.cursorX > 0 && this.cursorX + spaceW + wordWidth(word) > this.availW) {
            this.newLine() // the breaking space is consumed
        } else if (spaceW === 1) {
            this.emit(word.preSpace, ' ', 1)
        }
        if (word.atom >= 0) {
            this.growLine(word.atomH)
            this.perItem[word.atom] = [{ x: this.cursorX, y: this.line, width: word.atomW, text: '' }]
            this.cursorX += word.atomW
            return
        }
        for (const seg of word.segs) this.placeSegment(seg)
    }

    /** Emits a word segment grapheme by grapheme, hard-breaking at the
     * line width when the segment overruns it. */
    private placeSegment(seg: InlineSegment): void {
        for (const unit of seg.units) {
            if (this.cursorX > 0 && this.cursorX + unit.w > this.availW) this.newLine()
            this.emit(seg.item, unit.g, unit.w)
        }
    }

    /** Appends text at the cursor to the item's fragments, extending
     * the previous fragment when contiguous on the same line. */
    private emit(item: number, text: string, width: number): void {
        this.growLine(1)
        const frags = this.perItem[item]
        const last = frags[frags.length - 1]
        if (last && last.y === this.line && last.x + last.width === this.cursorX) {
            last.text += text
            last.width += width
        } else {
            frags.push({ x: this.cursorX, y: this.line, width, text })
        }
        this.cursorX += width
    }

    private newLine(): void {
        this.lineWidths.push(this.cursorX)
        this.line++
        this.cursorX = 0
        this.lineHeights.push(0)
    }

    private growLine(h: number): void {
        if (this.lineHeights[this.line] < h) this.lineHeights[this.line] = h
    }

    /** Rewrites fragment y values from line indices to row offsets
     * (prefix sums of line heights) and applies per-line text-align
     * shifts within availW. */
    resolveLines(): BrokenRun {
        this.lineWidths.push(this.cursorX) // close the last line
        const offsets: number[] = []
        let y = 0
        for (const h of this.lineHeights) {
            offsets.push(y)
            y += h
        }
        for (const frags of this.perItem) {
            for (const frag of frags) {
                frag.x += this.alignShift(frag.y)
                frag.y = offsets[frag.y]
            }
        }
        return { perItem: this.perItem, width: Math.max(0, ...this.lineWidths), height: y }
    }

    private alignShift(line: number): number {
        if (this.align === 'left' || !Number.isFinite(this.availW)) return 0
        const pad = this.availW - this.lineWidths[line]
        if (pad <= 0) return 0
        return this.align === 'center' ? Math.floor(pad / 2) : pad
    }
}
