/**
 * <img> support: pixel store, async source loading (file path or
 * data:image/png URI), and half-block painting — each cell shows two
 * vertically stacked pixels via '▀' with fg = top, bg = bottom.
 */

import { TermNode } from '../renderer/node.js'
import { CellBuffer } from './buffer.js'
import { decodePng, type DecodedImage } from './png.js'
import type { LayoutBox } from '../layout/engine.js'

type ImageState = { kind: 'loaded'; image: DecodedImage } | { kind: 'loading' } | { kind: 'failed' }

const imagesByNode = new WeakMap<TermNode, ImageState>()
const loadedSrcByNode = new WeakMap<TermNode, string>()

/** The decoded image for a node, if its current src has loaded. */
export function imageFor(node: TermNode): DecodedImage | null {
    if (loadedSrcByNode.get(node) !== node.attributes.get('src')) return null
    const state = imagesByNode.get(node)
    return state?.kind === 'loaded' ? state.image : null
}

/** Directly provide pixels (embedders, tests) — bypasses src loading. */
export function setImagePixels(node: TermNode, image: DecodedImage): void {
    imagesByNode.set(node, { kind: 'loaded', image })
    loadedSrcByNode.set(node, node.attributes.get('src') ?? '')
}

/** Kick off an async load of the node's src if not already under way. */
export function ensureImageLoading(node: TermNode): void {
    const src = node.attributes.get('src')
    if (!src) return
    if (loadedSrcByNode.get(node) === src) return
    loadedSrcByNode.set(node, src)
    imagesByNode.set(node, { kind: 'loading' })
    loadSource(src).then(image => {
        // src may have changed while decoding
        if (loadedSrcByNode.get(node) !== src) return
        imagesByNode.set(node, { kind: 'loaded', image })
        invalidate(node, 'loaded')
    }).catch(() => {
        if (loadedSrcByNode.get(node) !== src) return
        imagesByNode.set(node, { kind: 'failed' })
        invalidate(node, 'failed')
    })
}

/**
 * Pixels arriving change the element's *intrinsic size*, which no style
 * property reflects — invalidate layout directly, not just styles.
 */
function invalidate(node: TermNode, state: string): void {
    node.attributes.set('data-image', state)
    if (!node.ctx) return
    node.ctx.queue.enqueueLayoutBubble(node)
    node.ctx.onScheduleRender?.()
}

async function loadSource(src: string): Promise<DecodedImage> {
    if (src.startsWith('data:image/png;base64,')) {
        const base64 = src.slice('data:image/png;base64,'.length)
        return await decodePng(base64ToBytes(base64))
    }
    if (src.startsWith('data:')) throw new Error('Only data:image/png URIs are supported')
    const fs = await import('node:fs/promises')
    return await decodePng(new Uint8Array(await fs.readFile(src)))
}

function base64ToBytes(base64: string): Uint8Array {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'))
    const binary = atob(base64)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
}

/** Intrinsic size in cells: 1 px per column, 2 px per row (half-blocks). */
export function imageIntrinsicSize(node: TermNode): { width: number; height: number } | null {
    const image = imageFor(node)
    if (!image) return null
    return { width: image.width, height: Math.ceil(image.height / 2) }
}

/** Paint the image into its box as half-blocks, nearest-neighbour scaled. */
export function paintImage(
    node: TermNode, buffer: CellBuffer, box: LayoutBox,
    clip?: { x: number; y: number; width: number; height: number } | null,
): void {
    const image = imageFor(node)
    if (!image || box.width <= 0 || box.height <= 0) return
    const pxHeight = box.height * 2
    for (let row = 0; row < box.height; row++) {
        const y = box.y + row
        if (clip && (y < clip.y || y >= clip.y + clip.height)) continue
        for (let col = 0; col < box.width; col++) {
            const x = box.x + col
            if (clip && (x < clip.x || x >= clip.x + clip.width)) continue
            const top = sample(image, col, row * 2, box.width, pxHeight)
            const bottom = sample(image, col, row * 2 + 1, box.width, pxHeight)
            buffer.setCell(x, y, {
                char: '▀',
                fg: top,
                bg: bottom,
            })
        }
    }
}

/** Nearest-neighbour sample scaled to (targetW × targetH); hex colour. */
function sample(image: DecodedImage, x: number, y: number, targetW: number, targetH: number): string {
    const sx = Math.min(image.width - 1, Math.floor((x / targetW) * image.width))
    const sy = Math.min(image.height - 1, Math.floor((y / targetH) * image.height))
    const at = (sy * image.width + sx) * 4
    if (image.rgba[at + 3] < 128) return 'default' // transparent → terminal bg
    return '#' + [image.rgba[at], image.rgba[at + 1], image.rgba[at + 2]]
        .map(c => c.toString(16).padStart(2, '0')).join('')
}
