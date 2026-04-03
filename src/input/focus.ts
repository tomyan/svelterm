import { TermNode } from '../renderer/node.js'

export class FocusManager {
    private elements: TermNode[] = []
    private focusIndex: number = -1

    get focused(): TermNode | null {
        if (this.focusIndex < 0 || this.focusIndex >= this.elements.length) return null
        return this.elements[this.focusIndex]
    }

    get count(): number {
        return this.elements.length
    }

    register(node: TermNode): void {
        if (!this.elements.includes(node)) {
            this.elements.push(node)
        }
    }

    unregister(node: TermNode): void {
        const idx = this.elements.indexOf(node)
        if (idx === -1) return

        const wasFocused = idx === this.focusIndex
        this.elements.splice(idx, 1)

        if (wasFocused) {
            this.clearFocusAttribute(node)
            this.focusIndex = -1
        } else if (idx < this.focusIndex) {
            this.focusIndex--
        }
    }

    focusNext(): void {
        if (this.elements.length === 0) return
        this.setFocusIndex((this.focusIndex + 1) % this.elements.length)
    }

    focusPrevious(): void {
        if (this.elements.length === 0) return
        const next = this.focusIndex <= 0
            ? this.elements.length - 1
            : this.focusIndex - 1
        this.setFocusIndex(next)
    }

    clearFocus(): void {
        if (this.focused) this.clearFocusAttribute(this.focused)
        this.focusIndex = -1
    }

    private setFocusIndex(index: number): void {
        const prev = this.focused
        if (prev) this.clearFocusAttribute(prev)
        this.focusIndex = index
        const next = this.focused
        if (next) next.attributes.set('data-focused', 'true')
    }

    private clearFocusAttribute(node: TermNode): void {
        node.attributes.delete('data-focused')
    }
}
