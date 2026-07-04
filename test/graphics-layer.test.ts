import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GraphicsLayer } from '../src/render/graphics-layer.js'
import { setImagePixels } from '../src/render/image.js'
import { detectCapabilities } from '../src/terminal/capabilities.js'
import { TermNode } from '../src/renderer/node.js'
import type { DecodedImage } from '../src/render/png.js'
import type { LayoutBox } from '../src/layout/engine.js'

function imgTree(): { root: TermNode; img: TermNode; layout: Map<number, LayoutBox> } {
    const root = new TermNode('element', 'root')
    const img = new TermNode('element', 'img')
    img.attributes.set('src', 'x.png')
    root.insertBefore(img, null)
    const image: DecodedImage = { width: 2, height: 2, rgba: new Uint8Array(16).fill(180) }
    setImagePixels(img, image)
    const layout = new Map<number, LayoutBox>()
    layout.set(root.id, { x: 0, y: 0, width: 20, height: 10 })
    layout.set(img.id, { x: 3, y: 2, width: 4, height: 2 })
    return { root, img, layout }
}

describe('GraphicsLayer', () => {

    it('transmits then places a visible image at its box', () => {
        // Given
        const { root, layout } = imgTree()
        const layer = new GraphicsLayer()

        // When
        const out = layer.render(root, layout)

        // Then: transmit once, move to the box, place scaled to it
        assert.ok(out.includes('a=t,f=32'), 'no transmit')
        assert.ok(out.includes('\x1b[3;4H'), `no move-to-box in ${JSON.stringify(out)}`)
        assert.ok(out.includes('a=p'), 'no placement')
        assert.ok(out.includes('c=4') && out.includes('r=2'), 'placement not scaled to box')
    })

    it('does not re-transmit pixel data on the next frame', () => {
        // Given
        const { root, layout } = imgTree()
        const layer = new GraphicsLayer()
        layer.render(root, layout)

        // When
        const second = layer.render(root, layout)

        // Then: re-places but doesn't re-transmit
        assert.ok(!second.includes('a=t,f=32'), 're-transmitted unchanged image')
        assert.ok(second.includes('a=p'), 'did not re-place')
    })

    it('deletes the placement when the image is no longer visible', () => {
        // Given
        const { root, img, layout } = imgTree()
        const layer = new GraphicsLayer()
        layer.render(root, layout)

        // When: the image scrolls away (no layout box)
        layout.delete(img.id)
        const out = layer.render(root, layout)

        // Then
        assert.ok(out.includes('a=d'), 'did not delete the vanished placement')
    })

    it('clear() deletes all active placements', () => {
        const { root, layout } = imgTree()
        const layer = new GraphicsLayer()
        layer.render(root, layout)
        assert.ok(layer.clear().includes('a=d'))
    })
})

describe('detectCapabilities graphics flag', () => {

    function routerReturning(xtversion: string | null) {
        return {
            query: async (write: string) => {
                if (write.includes('>0q')) return xtversion ? `\x1bP>|${xtversion}\x1b\\` : null
                return null
            },
        } as any
    }

    it('is true for a kitty-graphics terminal', async () => {
        const caps = await detectCapabilities(routerReturning('ghostty 1.1'), {})
        assert.equal(caps.graphics, true)
    })

    it('is false for a terminal without graphics', async () => {
        const caps = await detectCapabilities(routerReturning('iTerm2 3.5'), {})
        assert.equal(caps.graphics, false)
    })

    it('is false when the terminal does not answer', async () => {
        const caps = await detectCapabilities(routerReturning(null), {})
        assert.equal(caps.graphics, false)
    })
})
