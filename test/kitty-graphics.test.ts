import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { transmitImage, placeImage, deletePlacement, graphicsSupported } from '../src/render/kitty-graphics.js'
import type { DecodedImage } from '../src/render/png.js'

const APC = '\x1b_'
const ST = '\x1b\\'

function image(w: number, h: number): DecodedImage {
    return { width: w, height: h, rgba: new Uint8Array(w * h * 4).fill(200) }
}

describe('graphicsSupported', () => {

    it('recognises kitty-graphics terminals from XTVERSION', () => {
        assert.equal(graphicsSupported('kitty(0.32.1)'), true)
        assert.equal(graphicsSupported('ghostty 1.1.0'), true)
        assert.equal(graphicsSupported('WezTerm 20240203'), true)
        assert.equal(graphicsSupported('iTerm2 3.5'), false)
        assert.equal(graphicsSupported('xterm'), false)
        assert.equal(graphicsSupported(null), false)
    })
})

describe('transmitImage', () => {

    it('wraps RGBA payload in an APC transmit command', () => {
        // When
        const out = transmitImage(7, image(2, 2))

        // Then
        assert.ok(out.startsWith(APC + 'G'))
        assert.ok(out.endsWith(ST))
        assert.ok(out.includes('i=7'))
        assert.ok(out.includes('f=32'))   // RGBA
        assert.ok(out.includes('s=2'))    // width
        assert.ok(out.includes('v=2'))    // height
        assert.ok(out.includes('a=t'))    // transmit only
    })

    it('chunks large payloads with continuation markers', () => {
        // Given: an image whose base64 exceeds one 4096-char chunk
        const out = transmitImage(1, image(64, 64))

        // Then: multiple APC segments, all but the last carry m=1
        const segments = out.split(ST).filter(s => s.length > 0)
        assert.ok(segments.length > 1, 'expected chunking')
        assert.ok(out.includes('m=1'))
        assert.ok(out.includes('m=0'))
    })
})

describe('placeImage', () => {

    it('emits a placement scaled to a cell box, not moving the cursor', () => {
        // When
        const out = placeImage(7, 3, 10, 4)

        // Then
        assert.ok(out.startsWith(APC + 'G'))
        assert.ok(out.includes('a=p'))
        assert.ok(out.includes('i=7'))
        assert.ok(out.includes('p=3'))
        assert.ok(out.includes('c=10'))   // columns
        assert.ok(out.includes('r=4'))    // rows
        assert.ok(out.includes('C=1'))    // don't move cursor
    })
})

describe('deletePlacement', () => {

    it('deletes a single placement, keeping the image data', () => {
        const out = deletePlacement(7, 3)
        assert.ok(out.includes('a=d'))
        assert.ok(out.includes('d=i'))
        assert.ok(out.includes('i=7'))
        assert.ok(out.includes('p=3'))
    })
})
