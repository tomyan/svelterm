import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { truncateText } from '../src/layout/text.js'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

describe('truncateText', () => {

    it('text shorter than width is unchanged', () => {
        assert.equal(truncateText('Hello', 10), 'Hello')
    })

    it('text equal to width is unchanged', () => {
        assert.equal(truncateText('Hello', 5), 'Hello')
    })

    it('text longer than width is truncated with ellipsis', () => {
        assert.equal(truncateText('Hello World', 8), 'Hello W…')
    })

    it('very short width shows just ellipsis', () => {
        assert.equal(truncateText('Hello', 1), '…')
    })

    it('width of 0 returns empty', () => {
        assert.equal(truncateText('Hello', 0), '')
    })

    it('empty text stays empty', () => {
        assert.equal(truncateText('', 10), '')
    })
})

describe('text-overflow: ellipsis in CSS', () => {

    it('truncates text in overflow:hidden container with text-overflow:ellipsis', () => {
        const root = new TermNode('element', 'root')
        const css = '.box{overflow:hidden;text-overflow:ellipsis;width:8cell;white-space:nowrap}'
        const stylesheet = parseCSS(css)

        const box = new TermNode('element', 'div')
        box.attributes.set('class', 'box')
        const text = new TermNode('text', 'Hello World')
        box.insertBefore(text, null)
        root.insertBefore(box, null)

        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 40, 5)
        const buffer = new CellBuffer(40, 5)
        paint(root, buffer, styles, layout)

        // Should show "Hello W…" (7 chars + ellipsis = 8)
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(6, 0)?.char, 'W')
        assert.equal(buffer.getCell(7, 0)?.char, '…')
        assert.equal(buffer.getCell(8, 0)?.char, ' ') // nothing beyond
    })
})
