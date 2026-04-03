import { TermNode } from '../renderer/node.js'

export class RenderQueue {
    paintOnly: Set<TermNode> = new Set()
    styleResolve: Set<TermNode> = new Set()
    layoutSubtree: Set<TermNode> = new Set()
    layoutBubble: Set<TermNode> = new Set()
    fullRecompute: boolean = false

    enqueuePaintOnly(node: TermNode): void {
        // Don't add if already queued for more comprehensive work
        if (this.styleResolve.has(node) || this.layoutSubtree.has(node) || this.layoutBubble.has(node)) return
        this.paintOnly.add(node)
    }

    enqueueStyleResolve(node: TermNode): void {
        this.paintOnly.delete(node) // style resolve subsumes paint
        this.styleResolve.add(node)
    }

    enqueueLayoutSubtree(node: TermNode): void {
        this.paintOnly.delete(node) // layout subsumes paint
        this.layoutSubtree.add(node)
    }

    enqueueLayoutBubble(node: TermNode): void {
        this.paintOnly.delete(node)
        this.layoutBubble.add(node)
    }

    setFullRecompute(): void {
        this.fullRecompute = true
    }

    isEmpty(): boolean {
        return !this.fullRecompute
            && this.paintOnly.size === 0
            && this.styleResolve.size === 0
            && this.layoutSubtree.size === 0
            && this.layoutBubble.size === 0
    }

    clear(): void {
        this.paintOnly.clear()
        this.styleResolve.clear()
        this.layoutSubtree.clear()
        this.layoutBubble.clear()
        this.fullRecompute = false
    }
}
