/**
 * DOM domain — tree inspection and live mutation over the debug
 * protocol. Serialises the TermNode tree (tags, attributes, text), finds
 * nodes by selector, reports box models, and edits attributes.
 */

import { matchesSelector } from '../css/selector.js'
import { type DebugContext, findNodeById } from './context.js'
import type { DebugDomain } from './server.js'
import type { TermNode } from '../renderer/node.js'

interface SerialNode {
    nodeId: number
    nodeType: string
    tag?: string
    text?: string
    attributes?: Record<string, string>
    children: SerialNode[]
}

export class DomDomain implements DebugDomain {
    constructor(private ctx: DebugContext) {}

    handle(method: string, params: Record<string, any>): any {
        switch (method) {
            case 'getDocument':
                return { root: serialise(this.ctx.root) }
            case 'querySelector':
                return { nodeId: this.firstMatch(params.selector)?.id ?? null }
            case 'getBoxModel':
                return this.boxModel(params.nodeId)
            case 'setAttribute':
                return this.setAttribute(params.nodeId, params.name, params.value)
            case 'removeAttribute':
                return this.removeAttribute(params.nodeId, params.name)
            default:
                throw new Error(`DOM.${method} not implemented`)
        }
    }

    private firstMatch(selector: string): TermNode | null {
        const walk = (node: TermNode): TermNode | null => {
            if (node.nodeType === 'element' && matchesSelector(node, selector)) return node
            for (const child of node.children) {
                const found = walk(child)
                if (found) return found
            }
            return null
        }
        for (const child of this.ctx.root.children) {
            const found = walk(child)
            if (found) return found
        }
        return null
    }

    private node(nodeId: number): TermNode {
        const node = findNodeById(this.ctx.root, nodeId)
        if (!node) throw new Error(`No node with id ${nodeId}`)
        return node
    }

    private boxModel(nodeId: number): Record<string, number> {
        const box = this.ctx.layout()?.get(nodeId)
        if (!box) throw new Error(`No layout for node ${nodeId}`)
        return { x: box.x, y: box.y, width: box.width, height: box.height }
    }

    private setAttribute(nodeId: number, name: string, value: string): Record<string, never> {
        const node = this.node(nodeId)
        if (node.ctx) node.ctx.onSetAttribute(node, name, value)
        else node.attributes.set(name, value)
        this.ctx.requestRender?.()
        return {}
    }

    private removeAttribute(nodeId: number, name: string): Record<string, never> {
        const node = this.node(nodeId)
        if (node.ctx) node.ctx.onRemoveAttribute(node, name)
        else node.attributes.delete(name)
        this.ctx.requestRender?.()
        return {}
    }
}

function serialise(node: TermNode): SerialNode {
    const out: SerialNode = {
        nodeId: node.id,
        nodeType: node.nodeType,
        children: node.children.map(serialise),
    }
    if (node.tag) out.tag = node.tag
    if (node.nodeType === 'text') out.text = node.text ?? ''
    if (node.attributes.size > 0) {
        out.attributes = Object.fromEntries(node.attributes)
    }
    return out
}
