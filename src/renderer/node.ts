let nextId = 1

export type NodeType = 'element' | 'text' | 'comment' | 'fragment'

export class TermNode {
    readonly id: number
    readonly nodeType: NodeType
    tag: string | undefined
    text: string | undefined

    parent: TermNode | null = null
    children: TermNode[] = []
    attributes: Map<string, string> = new Map()
    listeners: Map<string, Set<(...args: any[]) => void>> = new Map()
    scrollTop: number = 0

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
    }

    removeChild(node: TermNode): void {
        if (node.parent !== this) return
        const idx = this.children.indexOf(node)
        if (idx !== -1) {
            this.children.splice(idx, 1)
        }
        node.parent = null
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
}
