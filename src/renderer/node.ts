import type { ResolvedStyle } from '../css/compute.js'
import type { LayoutBox } from '../layout/engine.js'
import type { RenderContext } from '../render/context.js'
import { TextBuffer } from '../components/text-buffer.js'
import type { Cell } from '../render/buffer.js'

let nextId = 1

export type NodeType = 'element' | 'text' | 'comment' | 'fragment'

export interface RenderCache {
    resolvedStyle: ResolvedStyle | null
    layoutBox: LayoutBox | null
    classAttr: string
}

export class TermNode {
    readonly id: number
    readonly nodeType: NodeType
    tag: string | undefined
    text: string | undefined

    ctx: RenderContext | null = null

    parent: TermNode | null = null
    children: TermNode[] = []
    attributes: Map<string, string> = new Map()
    listeners: Map<string, Set<(...args: any[]) => void>> = new Map()
    scrollTop: number = 0
    scrollLeft: number = 0
    scrollbarVisibleUntil: number = 0
    hScrollbarVisibleUntil: number = 0
    textBuffer: TextBuffer | null = null
    cache: RenderCache = { resolvedStyle: null, layoutBox: null, classAttr: '' }

    /** DOM compatibility — Svelte's effects set nodeValue directly when renderer is not pushed */
    get nodeValue(): string | null {
        if (this.nodeType === 'text' || this.nodeType === 'comment') return this.text ?? null
        return null
    }

    set nodeValue(value: string | null) {
        if (this.nodeType === 'text' || this.nodeType === 'comment') {
            const newText = value ?? ''
            if (this.ctx) {
                this.ctx.onSetText(this, newText)
            } else {
                this.text = newText
            }
        }
    }

    /** DOM compatibility — Svelte may also use textContent */
    get textContent(): string {
        return this.collectText()
    }

    set textContent(value: string) {
        if (this.nodeType === 'text') {
            if (this.ctx) {
                this.ctx.onSetText(this, value)
            } else {
                this.text = value
            }
        }
    }

    constructor(nodeType: NodeType, tagOrText?: string) {
        this.id = nextId++
        this.nodeType = nodeType

        if (nodeType === 'element') {
            this.tag = tagOrText
        } else if (nodeType === 'text' || nodeType === 'comment') {
            this.text = tagOrText ?? ''
        }
    }

    get classes(): Set<string> {
        const raw = this.attributes.get('class') ?? ''
        if (raw === '') return new Set()
        return new Set(raw.split(/\s+/).filter(Boolean))
    }

    /** DOM compat — returns the root of the tree */
    getRootNode(): TermNode {
        let node: TermNode = this
        while (node.parent) node = node.parent
        return node
    }

    /** DOM compat — append_styles uses querySelector */
    querySelector(selector: string): TermNode | null {
        // Simple #id selector support for append_styles
        if (selector.startsWith('#')) {
            const id = selector.slice(1)
            return this.findById(id)
        }
        return null
    }

    private findById(id: string): TermNode | null {
        if (this.attributes.get('id') === id) return this
        for (const child of this.children) {
            const found = child.findById(id)
            if (found) return found
        }
        return null
    }

    /** DOM compat — append_styles checks for .host on the root */
    get host(): undefined { return undefined }

    /** DOM compat — append_styles accesses .head */
    get head(): TermNode { return this }

    /** DOM compat — append_styles accesses .ownerDocument */
    get ownerDocument(): TermNode { return this.getRootNode() }

    getFirstChild(): TermNode | null {
        return this.children[0] ?? null
    }

    getLastChild(): TermNode | null {
        return this.children[this.children.length - 1] ?? null
    }

    getNextSibling(): TermNode | null {
        if (!this.parent) return null
        const siblings = this.parent.children
        const idx = siblings.indexOf(this)
        return siblings[idx + 1] ?? null
    }

    insertBefore(node: TermNode, anchor: TermNode | null): void {
        this.removeChild(node)
        node.parent = this

        if (node.nodeType === 'fragment') {
            const fragmentChildren = [...node.children]
            for (const child of fragmentChildren) {
                this.insertBefore(child, anchor)
            }
            return
        }

        if (anchor === null) {
            this.children.push(node)
        } else {
            const idx = this.children.indexOf(anchor)
            if (idx === -1) {
                this.children.push(node)
            } else {
                this.children.splice(idx, 0, node)
            }
        }

        if (this.ctx) propagateCtx(node, this.ctx)
    }

    removeChild(node: TermNode): void {
        if (node.parent !== this) return
        const idx = this.children.indexOf(node)
        if (idx !== -1) {
            this.children.splice(idx, 1)
        }
        node.parent = null
        clearCtx(node)
    }

    remove(): void {
        if (this.parent) {
            this.parent.removeChild(this)
        }
    }

    collectText(): string {
        if (this.nodeType === 'text') return this.text ?? ''
        if (this.nodeType === 'comment') return ''
        return this.children.map(c => c.collectText()).join('')
    }

    invalidateStyle(): void {
        this.cache.resolvedStyle = null
        this.cache.classAttr = ''
    }

    invalidateLayout(): void {
        this.cache.layoutBox = null
    }

    invalidateAll(): void {
        this.invalidateStyle()
        this.invalidateLayout()
    }

    cleanup(): void {
        this.listeners.clear()
        this.ctx = null
        for (const child of this.children) {
            child.cleanup()
        }
    }
}

/**
 * A layout-participating region whose contents are filled by an external
 * source. The consumer (typically `EmbeddedTerminal`) registers a
 * cell-source function via `setCellSource`, and the paint phase calls
 * it for each cell of the region's allocated box.
 *
 * Local coordinates: the cell-source function receives `(col, row)`
 * relative to the region's own top-left, NOT the surrounding buffer.
 *
 * Resize: when the layout-allocated cell dimensions change between
 * paints, a `resize` event fires with `{ cols, rows }` so the consumer
 * can resize the upstream Terminal / stream to match.
 */
export class SvtRegionNode extends TermNode {
    private cellSource: ((col: number, row: number) => Cell) | null = null
    private lastCols = -1
    private lastRows = -1

    constructor() {
        super('element', 'svt-region')
    }

    setCellSource(fn: (col: number, row: number) => Cell): void {
        this.cellSource = fn
    }

    getCellSource(): ((col: number, row: number) => Cell) | null {
        return this.cellSource
    }

    /**
     * Called by the paint phase with the region's currently-allocated
     * dimensions. Fires `resize` if they've changed since the last call.
     * Returns the (possibly newly-fired) dimensions.
     */
    notifyAllocatedSize(cols: number, rows: number, fire: (cols: number, rows: number) => void): void {
        if (cols === this.lastCols && rows === this.lastRows) return
        this.lastCols = cols
        this.lastRows = rows
        fire(cols, rows)
    }

    /**
     * Mark the region as needing a repaint. Consumers call this when
     * their cell source's output has changed (e.g. after their upstream
     * Terminal has consumed new bytes from a stream). Schedules a paint
     * via the render context and re-runs the paint pipeline.
     */
    markDirty(): void {
        if (!this.ctx) return
        this.ctx.queue.enqueuePaintOnly(this)
        this.ctx.onScheduleRender?.()
    }
}

function propagateCtx(node: TermNode, ctx: RenderContext): void {
    node.ctx = ctx
    for (const child of node.children) {
        propagateCtx(child, ctx)
    }
}

function clearCtx(node: TermNode): void {
    node.ctx = null
    for (const child of node.children) {
        clearCtx(child)
    }
}
