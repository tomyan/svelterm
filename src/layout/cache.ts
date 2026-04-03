import { TermNode } from '../renderer/node.js'
import type { LayoutBox } from './engine.js'

/** Sync layout boxes from the computed map into each node's cache. */
export function syncLayoutCache(node: TermNode, layout: Map<number, LayoutBox>): void {
    const box = layout.get(node.id)
    node.cache.layoutBox = box ?? null
    for (const child of node.children) {
        syncLayoutCache(child, layout)
    }
}
