import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { paint } from '../src/render/paint.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { setImagePixels } from '../src/render/image.js'
import type { DecodedImage } from '../src/render/png.js'

/** 2×4 image: red/green columns on top half, blue/white on bottom. */
function testImage(): DecodedImage {
    const px = (r: number, g: number, b: number) => [r, g, b, 255]
    const rows = [
        [px(255, 0, 0), px(0, 255, 0)],
        [px(255, 0, 0), px(0, 255, 0)],
        [px(0, 0, 255), px(255, 255, 255)],
        [px(0, 0, 255), px(255, 255, 255)],
    ]
    return { width: 2, height: 4, rgba: new Uint8Array(rows.flat(2)) }
}

function renderImg(css: string) {
    const root = new TermNode('element', 'root')
    const img = new TermNode('element', 'img')
    img.attributes.set('src', 'test.png')
    root.insertBefore(img, null)
    setImagePixels(img, testImage())
    const styles = resolveStyles(root, parseCSS(DEFAULT_STYLESHEET + css))
    const layout = computeLayout(root, styles, 10, 5)
    const buffer = new CellBuffer(10, 5)
    paint(root, buffer, styles, layout)
    return { buffer, layout, img }
}

describe('<img> half-block rendering', () => {

    it('sizes intrinsically: one column per pixel, one row per two pixels', () => {
        // When
        const { layout, img } = renderImg('')

        // Then: 2×4 px → 2 cols × 2 rows
        const box = layout.get(img.id)
        assert.equal(box?.width, 2)
        assert.equal(box?.height, 2)
    })

    it('paints half-blocks with top pixel as fg and bottom as bg', () => {
        // When
        const { buffer } = renderImg('')

        // Then
        const cell = buffer.getCell(0, 0)
        assert.equal(cell?.char, '▀')
        assert.equal(cell?.fg, '#ff0000')
        assert.equal(cell?.bg, '#ff0000')
        const lower = buffer.getCell(0, 1)
        assert.equal(lower?.fg, '#0000ff')
        assert.equal(lower?.bg, '#0000ff')
        assert.equal(buffer.getCell(1, 1)?.fg, '#ffffff')
    })

    it('scales to explicit CSS dimensions', () => {
        // When: stretch to 4×4 cells
        const { buffer, layout, img } = renderImg('img { width: 4cell; height: 4cell; }')

        // Then
        assert.equal(layout.get(img.id)?.width, 4)
        assert.equal(buffer.getCell(0, 0)?.char, '▀')
        assert.equal(buffer.getCell(3, 3)?.fg, '#ffffff')
    })
})
