import { createRenderer as svelteCreateRenderer } from 'svelte/renderer'
import type { Component, ComponentType, SvelteComponent } from 'svelte'
import { TermNode, SvtRegionNode, syncTextareaValueChild } from './node.js'

type TermNodes = {
    fragment: TermNode
    element: TermNode
    text: TermNode
    comment: TermNode
}

/**
 * Insert a node and notify the render context about what actually landed.
 * A fragment's children move into the parent (the emptied fragment never
 * joins the tree), so context notification — which drives incremental
 * style resolution — must target those children, not the fragment.
 */
export function insertWithContext(parent: TermNode, node: TermNode, anchor: TermNode | null): void {
    const inserted = flattenFragment(node)
    parent.insertBefore(node, anchor)
    for (const child of inserted) parent.ctx?.onInsert(parent, child)
}

function flattenFragment(node: TermNode): TermNode[] {
    if (node.nodeType !== 'fragment') return [node]
    return node.children.flatMap(flattenFragment)
}

export function createTermRenderer(): ReturnType<typeof svelteCreateRenderer<TermNodes>> {
    return svelteCreateRenderer<TermNodes>({
        createFragment(): TermNode {
            return new TermNode('fragment')
        },

        createElement(name: string): TermNode {
            if (name === 'svt-region') return new SvtRegionNode()
            return new TermNode('element', name)
        },

        createTextNode(data: string): TermNode {
            return new TermNode('text', data)
        },

        createComment(data: string): TermNode {
            return new TermNode('comment', data)
        },

        nodeType(node: TermNode): 'fragment' | 'element' | 'text' | 'comment' {
            return node.nodeType
        },

        getNodeValue(node: TermNode): string | null {
            if (node.nodeType === 'text') return node.text ?? null
            if (node.nodeType === 'comment') return node.text ?? null
            return null
        },

        getAttribute(element: TermNode, name: string): string | null {
            return element.attributes.get(name) ?? null
        },

        setAttribute(element: TermNode, key: string, value: any): void {
            const ctx = element.ctx
            if (ctx) {
                ctx.onSetAttribute(element, key, String(value))
            } else {
                element.attributes.set(key, String(value))
                // Pre-insertion writes still shape the tree (Svelte's first
                // template effect runs before append)
                if (key === 'value') syncTextareaValueChild(element, String(value))
            }
        },

        removeAttribute(element: TermNode, name: string): void {
            const ctx = element.ctx
            if (ctx) {
                ctx.onRemoveAttribute(element, name)
            } else {
                element.attributes.delete(name)
            }
        },

        hasAttribute(element: TermNode, name: string): boolean {
            return element.attributes.has(name)
        },

        setText(node: TermNode, text: string): void {
            if (node.nodeType === 'text' || node.nodeType === 'comment') {
                const ctx = node.ctx
                if (ctx) {
                    ctx.onSetText(node, text)
                } else {
                    node.text = text
                }
            } else {
                node.children = []
                const textNode = new TermNode('text', text)
                textNode.parent = node
                textNode.ctx = node.ctx
                node.children.push(textNode)
                node.ctx?.onInsert(node, textNode)
            }
        },

        getFirstChild(element: TermNode): TermNode | null {
            return element.getFirstChild()
        },

        getLastChild(element: TermNode): TermNode | null {
            return element.getLastChild()
        },

        getNextSibling(node: TermNode): TermNode | null {
            return node.getNextSibling()
        },

        insert(parent: TermNode, node: TermNode, anchor: TermNode | null): void {
            insertWithContext(parent, node, anchor)
        },

        remove(node: TermNode): void {
            const parent = node.parent
            const ctx = parent?.ctx ?? null
            node.remove()
            if (ctx && parent) ctx.onRemove(node, parent)
        },

        getParent(node: TermNode): TermNode | null {
            return node.parent
        },

        addEventListener(target: TermNode, type: string, handler: any): void {
            let handlers = target.listeners.get(type)
            if (!handlers) {
                handlers = new Set()
                target.listeners.set(type, handlers)
            }
            handlers.add(handler)
        },

        removeEventListener(target: TermNode, type: string, handler: any): void {
            const handlers = target.listeners.get(type)
            if (handlers) {
                handlers.delete(handler)
            }
        },
    })
}

/**
 * Keep the custom renderer active globally so Svelte's effects
 * use our renderer methods (setText, setAttribute, etc.) instead
 * of falling back to DOM operations (node.nodeValue, etc.).
 *
 * Call this AFTER renderer.render() which pops the renderer.
 */
export { TermNode, SvtRegionNode } from './node.js'
