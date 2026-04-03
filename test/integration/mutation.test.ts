import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText } from './harness.js'
import { CellBuffer } from '../../src/render/buffer.js'
import { paint } from '../../src/render/paint.js'
import { paintNodes } from '../../src/render/incremental-paint.js'
import { resolveStyles } from '../../src/css/compute.js'
import { resolveStylesIncremental } from '../../src/css/incremental.js'
import { parseCSS } from '../../src/css/parser.js'
import { computeLayout } from '../../src/layout/engine.js'
import { syncLayoutCache } from '../../src/layout/cache.js'
import { diffBuffers } from '../../src/render/diff.js'

describe('integration: mutations and incremental render', () => {

    it('text change same length produces correct incremental output', () => {
        // Given: initial render
        const tree = el('div', {}, [text('AAA')])
        const { buffer, styles, layout, root } = render(tree, {
            css: '', width: 20, height: 3,
        })

        // When: change text and do incremental paint
        const textNode = tree.children[0]
        textNode.text = 'BBB'

        const newBuffer = buffer.clone()
        paintNodes(new Set([textNode]), newBuffer, styles, layout, root)

        // Then: text updated
        assert.equal(newBuffer.getCell(0, 0)?.char, 'B')
        assert.equal(newBuffer.getCell(2, 0)?.char, 'B')
    })

    it('text shrinking clears old area', () => {
        // Given: initial render with long text
        const tree = el('div', {}, [text('Hello World')])
        const { buffer, styles, layout, root } = render(tree, {
            css: '', width: 20, height: 3,
        })

        // When: shrink text
        const textNode = tree.children[0]
        // Cache current layout box (simulating what syncLayoutCache does)
        textNode.cache.layoutBox = layout.get(textNode.id) ?? null

        textNode.text = 'Hi'
        layout.set(textNode.id, { x: 0, y: 0, width: 2, height: 1 })

        const newBuffer = buffer.clone()
        paintNodes(new Set([textNode]), newBuffer, styles, layout, root)

        // Then: new text present, old area cleared
        assert.equal(newBuffer.getCell(0, 0)?.char, 'H')
        assert.equal(newBuffer.getCell(1, 0)?.char, 'i')
        assert.equal(newBuffer.getCell(2, 0)?.char, ' ')
        assert.equal(newBuffer.getCell(10, 0)?.char, ' ')
    })

    it('class change triggers style update', () => {
        // Given
        const tree = el('div', { class: 'normal' }, [text('Hi')])
        const { buffer, styles, root } = render(tree, {
            css: `.normal { color: white; }
                  .active { color: green; font-weight: bold; }`,
            width: 20, height: 3,
        })
        assert.equal(buffer.getCell(0, 0)?.fg, 'white')

        // When: change class
        tree.attributes.set('class', 'active')
        tree.invalidateStyle()

        const stylesheet = parseCSS(`.normal { color: white; } .active { color: green; font-weight: bold; }`)
        const newStyles = resolveStylesIncremental(
            root, stylesheet, styles, new Set([tree]),
        )

        // Then: style changed
        assert.equal(newStyles.get(tree.id)?.fg, 'green')
        assert.equal(newStyles.get(tree.id)?.bold, true)
    })

    it('node insertion and full re-render shows new content', () => {
        // Given
        const tree = el('div', {}, [
            el('div', {}, [text('First')]),
        ])
        const { root } = render(tree, { css: '', width: 20, height: 5 })

        // When: add a second child
        const newChild = el('div', {}, [text('Second')])
        tree.insertBefore(newChild, null)

        // Re-render fully
        const stylesheet = parseCSS('')
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 20, 5)
        syncLayoutCache(root, layout)

        const newBuffer = new CellBuffer(20, 5)
        paint(root, newBuffer, styles, layout)

        // Then: both children visible
        assert.equal(rowText(newBuffer, 0), 'First')
        assert.equal(rowText(newBuffer, 1), 'Second')
    })

    it('node removal and full re-render clears old content', () => {
        // Given
        const tree = el('div', {}, [
            el('div', {}, [text('Keep')]),
            el('div', {}, [text('Remove')]),
        ])
        const { root } = render(tree, { css: '', width: 20, height: 5 })

        // When: remove second child
        const toRemove = tree.children[1]
        tree.removeChild(toRemove)

        // Re-render fully
        const stylesheet = parseCSS('')
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 20, 5)
        syncLayoutCache(root, layout)

        const newBuffer = new CellBuffer(20, 5)
        paint(root, newBuffer, styles, layout)

        // Then: only first child visible
        assert.equal(rowText(newBuffer, 0), 'Keep')
        assert.equal(rowText(newBuffer, 1), '')
    })

    it('diff produces minimal output for single cell change', () => {
        // Given: two identical buffers
        const buf1 = new CellBuffer(10, 3)
        buf1.writeText(0, 0, 'Hello')

        const buf2 = buf1.clone()
        buf2.writeText(0, 0, 'Hallo')

        // When
        const output = diffBuffers(buf1, buf2)

        // Then: output is non-empty and contains 'a' (the changed char)
        assert.ok(output.length > 0)
        assert.ok(output.includes('a'))
        // Should be reasonably short (not a full redraw of all 30 cells)
        assert.ok(output.length < 30, `diff too long (${output.length} chars): should be minimal`)
    })
})
