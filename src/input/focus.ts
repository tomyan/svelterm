import { TermNode, hasBooleanAttribute } from '../renderer/node.js'
import { withinSubtree } from './modal.js'

export class FocusManager {
    private elements: TermNode[] = []
    private focusIndex: number = -1
    /** When set, focus cycling is trapped inside this subtree (modals). */
    private scope: TermNode | null = null
    onSetAttribute?: (node: TermNode, key: string, value: string) => void
    onRemoveAttribute?: (node: TermNode, key: string) => void
    onFocusChange?: (focused: TermNode | null, previous: TermNode | null) => void

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

    /** Trap focus cycling inside `node`'s subtree; null lifts the trap. */
    setScope(node: TermNode | null): void {
        this.scope = node
    }

    focusNext(): void {
        this.focusFirstEnabledFrom(this.focusIndex, +1)
    }

    focusPrevious(): void {
        const start = this.focusIndex === -1 ? this.elements.length : this.focusIndex
        this.focusFirstEnabledFrom(start, -1)
    }

    focusByNode(node: TermNode): void {
        if (hasBooleanAttribute(node, 'disabled')) return
        const idx = this.elements.indexOf(node)
        if (idx !== -1) this.setFocusIndex(idx)
    }

    clearFocus(): void {
        if (this.focused) this.clearFocusAttribute(this.focused)
        this.focusIndex = -1
    }

    /** Step through the ring from `start` until an enabled element is found. */
    private focusFirstEnabledFrom(start: number, step: 1 | -1): void {
        const count = this.elements.length
        for (let offset = 1; offset <= count; offset++) {
            const index = ((start + step * offset) % count + count) % count
            const element = this.elements[index]
            if (hasBooleanAttribute(element, 'disabled')) continue
            if (this.scope && !withinSubtree(element, this.scope)) continue
            this.setFocusIndex(index)
            return
        }
    }

    private setFocusIndex(index: number): void {
        const prev = this.focused
        if (prev) this.clearFocusAttribute(prev)
        this.focusIndex = index
        const next = this.focused
        if (next) {
            if (this.onSetAttribute) {
                this.onSetAttribute(next, 'data-focused', 'true')
            } else {
                next.attributes.set('data-focused', 'true')
            }
        }
        this.onFocusChange?.(next, prev)
    }

    private clearFocusAttribute(node: TermNode): void {
        if (this.onRemoveAttribute) {
            this.onRemoveAttribute(node, 'data-focused')
        } else {
            node.attributes.delete('data-focused')
        }
    }
}
