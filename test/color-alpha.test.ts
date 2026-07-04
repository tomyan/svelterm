import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveColor, blendColor } from '../src/css/color.js'
import { CellBuffer } from '../src/render/buffer.js'
import { paint } from '../src/render/paint.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'

describe('resolveColor keeps alpha', () => {

    it('legacy rgba() carries its alpha as 8-digit hex', () => {
        assert.equal(resolveColor('rgba(255, 0, 0, 0.5)'), '#ff000080')
    })

    it('modern slash alpha carries through', () => {
        assert.equal(resolveColor('rgb(255 0 0 / 0.25)'), '#ff000040')
        assert.equal(resolveColor('hsl(0 100% 50% / 0.5)'), '#ff000080')
    })

    it('fully transparent resolves to default', () => {
        assert.equal(resolveColor('rgba(255, 0, 0, 0)'), 'default')
    })

    it('fully opaque stays 6-digit', () => {
        assert.equal(resolveColor('rgba(255, 0, 0, 1)'), '#ff0000')
    })

    it('8-digit hex literals pass through', () => {
        assert.equal(resolveColor('#ff000080'), '#ff000080')
    })
})

describe('blendColor', () => {

    it('mixes an alpha colour over a hex base', () => {
        assert.equal(blendColor('#0000ff', '#ff000080'), '#80007f')
    })

    it('blends over ANSI names via their nominal values', () => {
        // blue nominal #0000ee
        assert.equal(blendColor('blue', '#ff000080'), '#800077')
    })

    it('treats default as black', () => {
        assert.equal(blendColor('default', '#ff000080'), '#800000')
    })

    it('returns an opaque over-colour unchanged', () => {
        assert.equal(blendColor('#0000ff', '#ff0000'), '#ff0000')
    })
})

describe('alpha compositing at paint', () => {

    function painted(css: string) {
        const root = new TermNode('element', 'root')
        const outer = new TermNode('element', 'div')
        outer.attributes.set('class', 'outer')
        const inner = new TermNode('element', 'div')
        inner.attributes.set('class', 'inner')
        const text = new TermNode('text', 'x')
        inner.insertBefore(text, null)
        outer.insertBefore(inner, null)
        root.insertBefore(outer, null)
        const styles = resolveStyles(root, parseCSS(css))
        const layout = computeLayout(root, styles, 10, 4)
        const buffer = new CellBuffer(10, 4)
        paint(root, buffer, styles, layout)
        return buffer
    }

    it('an rgba background blends over the parent background', () => {
        // Given / When
        const buffer = painted(`
            .outer { background: #0000ff; width: 10cell; height: 3cell; }
            .inner { background: rgba(255, 0, 0, 0.5); width: 4cell; height: 1cell; }
        `)

        // Then
        assert.equal(buffer.getCell(0, 0)?.bg, '#80007f')
        assert.equal(buffer.getCell(6, 0)?.bg, '#0000ff')
    })

    it('numeric opacity blends the element toward what is beneath it', () => {
        // Given / When
        const buffer = painted(`
            .outer { background: #000000; width: 10cell; height: 3cell; }
            .inner { background: #ff0000; opacity: 0.5; width: 4cell; height: 1cell; }
        `)

        // Then
        assert.equal(buffer.getCell(0, 0)?.bg, '#800000')
    })
})
