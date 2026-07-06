/**
 * Kill ring mirroring sumi edit.go: every kill appends and becomes the
 * yank target; yank-pop steps back through older kills, wrapping.
 */
export class KillRing {
    private entries: string[] = []
    private idx = 0

    push(text: string): void {
        if (text === '') return
        this.entries.push(text)
        this.idx = this.entries.length - 1
    }

    /** The entry a yank inserts, or null when nothing was killed yet. */
    current(): string | null {
        return this.entries[this.idx] ?? null
    }

    /** Step to the previous entry (wrapping) and return it. */
    cyclePrev(): string | null {
        if (this.entries.length === 0) return null
        this.idx = this.idx === 0 ? this.entries.length - 1 : this.idx - 1
        return this.entries[this.idx]
    }

    get size(): number { return this.entries.length }
}
