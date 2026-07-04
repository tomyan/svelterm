/**
 * CSS domain — computed style inspection over the debug protocol.
 * Returns the resolved style svelterm actually used to paint a node.
 */

import { type DebugContext, findNodeById } from './context.js'
import type { DebugDomain } from './server.js'

export class CssDomain implements DebugDomain {
    constructor(private ctx: DebugContext) {}

    handle(method: string, params: Record<string, any>): any {
        switch (method) {
            case 'getComputedStyle':
                return { style: this.computedStyle(params.nodeId) }
            default:
                throw new Error(`CSS.${method} not implemented`)
        }
    }

    private computedStyle(nodeId: number): Record<string, unknown> {
        if (!findNodeById(this.ctx.root, nodeId)) throw new Error(`No node with id ${nodeId}`)
        const style = this.ctx.styles()?.get(nodeId)
        if (!style) throw new Error(`No computed style for node ${nodeId}`)
        // Structured-clone-safe copy (drop any functions/undefined)
        return JSON.parse(JSON.stringify(style))
    }
}
