import { createRenderer as svelteCreateRenderer, type Renderer } from 'svelte/renderer'
import type { Component, ComponentType, SvelteComponent } from 'svelte'
import { TermNode } from './node.js'

export function createTermRenderer(): ReturnType<typeof svelteCreateRenderer<TermNode, TermNode, TermNode, TermNode>> {
    return svelteCreateRenderer<TermNode, TermNode, TermNode, TermNode>({
        createFragment(): TermNode {
            return new TermNode('fragment')
        },

        createElement(name: string): TermNode {
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
            parent.insertBefore(node, anchor)
            parent.ctx?.onInsert(parent, node)
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
export { TermNode } from './node.js'
