import { TermNode } from '../renderer/node.js'
import { RenderQueue } from './queue.js'

/**
 * RenderContext tracks mutations and determines the minimum rendering path.
 * Each renderer method calls the appropriate onX method, which enqueues
 * the minimum work needed.
 */
export class RenderContext {
    readonly queue = new RenderQueue()
    onScheduleRender?: () => void

    onSetText(node: TermNode, newText: string): void {
        const oldText = node.text ?? ''
        node.text = newText

        if (oldText.length === newText.length) {
            this.queue.enqueuePaintOnly(node)
        } else {
            this.queue.enqueueLayoutBubble(node)
        }
        this.onScheduleRender?.()
    }

    onSetAttribute(node: TermNode, key: string, value: string): void {
        if (key === 'class') {
            if (node.cache.classAttr === value) return // no change
            node.cache.classAttr = value
            node.invalidateStyle()
            this.queue.enqueueStyleResolve(node)
            // Also invalidate descendants — descendant selectors may change
            this.invalidateDescendantStyles(node)
        } else if (key === 'id' || key === 'data-focused' || key === 'data-hovered') {
            node.invalidateStyle()
            this.queue.enqueueStyleResolve(node)
        } else {
            this.queue.enqueuePaintOnly(node)
        }

        node.attributes.set(key, value)
        this.onScheduleRender?.()
    }

    onRemoveAttribute(node: TermNode, key: string): void {
        node.attributes.delete(key)
        if (key === 'class' || key === 'id' || key === 'data-focused' || key === 'data-hovered') {
            node.cache.classAttr = ''
            node.invalidateStyle()
            this.queue.enqueueStyleResolve(node)
            this.invalidateDescendantStyles(node)
        }
        this.onScheduleRender?.()
    }

    onInsert(parent: TermNode, child: TermNode): void {
        // New node needs full computation
        child.invalidateAll()
        this.queue.enqueueStyleResolve(child)

        // Parent needs re-layout
        if (hasFixedDimensions(parent)) {
            this.queue.enqueueLayoutSubtree(parent)
        } else {
            this.queue.enqueueLayoutBubble(parent)
        }
        this.onScheduleRender?.()
    }

    onRemove(child: TermNode, parent: TermNode): void {
        if (hasFixedDimensions(parent)) {
            this.queue.enqueueLayoutSubtree(parent)
        } else {
            this.queue.enqueueLayoutBubble(parent)
        }
        // Paint the area where the removed node was
        this.queue.enqueuePaintOnly(parent)
        this.onScheduleRender?.()
    }

    onScroll(node: TermNode): void {
        this.queue.setFullRecompute()
        this.onScheduleRender?.()
    }

    onResize(): void {
        this.queue.setFullRecompute()
        this.onScheduleRender?.()
    }

    private invalidateDescendantStyles(node: TermNode): void {
        for (const child of node.children) {
            if (child.nodeType === 'element') {
                child.invalidateStyle()
                this.queue.enqueueStyleResolve(child)
                this.invalidateDescendantStyles(child)
            }
        }
    }
}

function hasFixedDimensions(node: TermNode): boolean {
    const style = node.cache.resolvedStyle
    if (!style) return false
    return style.width !== null && style.height !== null
}
