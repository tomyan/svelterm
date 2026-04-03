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
            element.attributes.set(key, String(value))
        },

        removeAttribute(element: TermNode, name: string): void {
            element.attributes.delete(name)
        },

        hasAttribute(element: TermNode, name: string): boolean {
            return element.attributes.has(name)
        },

        setText(node: TermNode, text: string): void {
            if (node.nodeType === 'text' || node.nodeType === 'comment') {
                node.text = text
            } else {
                node.children = []
                const textNode = new TermNode('text', text)
                textNode.parent = node
                node.children.push(textNode)
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
        },

        remove(node: TermNode): void {
            node.remove()
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

export { TermNode } from './node.js'
