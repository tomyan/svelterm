/**
 * Graphics layer — post-frame kitty-image placement over `<img>` boxes.
 * The half-block cells are still painted into the buffer (fallback and
 * layout truth); when the terminal supports kitty graphics, this covers
 * them with real pixels, keyed to each img node.
 *
 * Correctness over cleverness: each frame deletes the previous placement
 * for every img we track and re-places the visible ones, so a moved,
 * resized, scrolled-away, or unmounted image never leaves a ghost. Pixel
 * data transmits once per (node, src).
 */

import { TermNode } from '../renderer/node.js'
import { moveTo } from './ansi.js'
import { transmitImage, placeImage, deletePlacement } from './kitty-graphics.js'
import { imageFor } from './image.js'
import type { LayoutBox } from '../layout/engine.js'

interface Tracked {
    imageId: number
    placementId: number
    transmittedSrc: string | null
    placed: boolean
}

export class GraphicsLayer {
    private tracked = new Map<number, Tracked>()
    private nextId = 1

    /**
     * Emit graphics commands for the current frame: clear last frame's
     * placements, then transmit (once) and place every visible img.
     * Returns the ANSI to write after the cell diff.
     */
    render(root: TermNode, layout: Map<number, LayoutBox> | undefined): string {
        const parts: string[] = []
        const visible = layout ? this.collectVisibleImages(root, layout) : []
        const visibleIds = new Set(visible.map(v => v.node.id))

        // Clear placements that were shown last frame (moved or gone)
        for (const [nodeId, entry] of this.tracked) {
            if (entry.placed && !visibleIds.has(nodeId)) {
                parts.push(deletePlacement(entry.imageId, entry.placementId))
                entry.placed = false
            }
        }

        for (const { node, box } of visible) {
            const image = imageFor(node)
            if (!image) continue
            const entry = this.entryFor(node.id)
            const src = node.attributes.get('src') ?? ''
            if (entry.transmittedSrc !== src) {
                parts.push(transmitImage(entry.imageId, image))
                entry.transmittedSrc = src
            }
            // Re-place every frame so it tracks the box exactly
            if (entry.placed) parts.push(deletePlacement(entry.imageId, entry.placementId))
            parts.push(moveTo(box.x + 1, box.y + 1))
            parts.push(placeImage(entry.imageId, entry.placementId, box.width, box.height))
            entry.placed = true
        }
        return parts.join('')
    }

    /** Delete every active placement (teardown, suspend). */
    clear(): string {
        const parts: string[] = []
        for (const entry of this.tracked.values()) {
            if (entry.placed) {
                parts.push(deletePlacement(entry.imageId, entry.placementId))
                entry.placed = false
            }
        }
        return parts.join('')
    }

    private entryFor(nodeId: number): Tracked {
        let entry = this.tracked.get(nodeId)
        if (!entry) {
            entry = { imageId: this.nextId++, placementId: 1, transmittedSrc: null, placed: false }
            this.tracked.set(nodeId, entry)
        }
        return entry
    }

    private collectVisibleImages(
        node: TermNode, layout: Map<number, LayoutBox>,
    ): Array<{ node: TermNode; box: LayoutBox }> {
        const out: Array<{ node: TermNode; box: LayoutBox }> = []
        const walk = (n: TermNode) => {
            if (n.nodeType === 'element' && n.tag === 'img') {
                const box = layout.get(n.id)
                if (box && box.width > 0 && box.height > 0 && imageFor(n)) out.push({ node: n, box })
            }
            for (const child of n.children) walk(child)
        }
        walk(node)
        return out
    }
}
