import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { paintNodes } from '../src/render/incremental-paint.js'
import { TermNode } from '../src/renderer/node.js'
import type { ResolvedStyle } from '../src/css/compute.js'
import type { LayoutBox } from '../src/layout/engine.js'
import { defaultStyle } from '../src/css/compute.js'

describe('incremental paint', () => {

    it('paints only specified nodes', () => {
        const root = new TermNode('element', 'root')
        const a = new TermNode('text', 'AAA')
        const b = new TermNode('text', 'BBB')
        root.insertBefore(a, null)
        root.insertBefore(b, null)

        const styles = new Map<number, ResolvedStyle>()
        styles.set(root.id, defaultStyle('div'))

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 10, height: 2 })
        layout.set(a.id, { x: 0, y: 0, width: 3, height: 1 })
        layout.set(b.id, { x: 0, y: 1, width: 3, height: 1 })

        const buffer = new CellBuffer(10, 5)
        buffer.writeText(0, 0, 'AAA')
        buffer.writeText(0, 1, 'BBB')

        // Change b's text
        b.text = 'CCC'

        // Only repaint b
        paintNodes(new Set([b]), buffer, styles, layout, root)

        // b's cells should be updated
        assert.equal(buffer.getCell(0, 1)?.char, 'C')
        assert.equal(buffer.getCell(2, 1)?.char, 'C')
        // a's cells should be unchanged
        assert.equal(buffer.getCell(0, 0)?.char, 'A')
    })

    it('incremental paint produces same output as full paint', () => {
        // Given: full render of a tree
        const root = new TermNode('element', 'root')
        const a = new TermNode('text', 'AAA')
        const b = new TermNode('text', 'BBB')
        root.insertBefore(a, null)
        root.insertBefore(b, null)

        const styles = new Map<number, ResolvedStyle>()
        styles.set(root.id, defaultStyle('div'))

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 10, height: 2 })
        layout.set(a.id, { x: 0, y: 0, width: 3, height: 1 })
        layout.set(b.id, { x: 0, y: 1, width: 3, height: 1 })

        // Full paint
        const fullBuffer = new CellBuffer(10, 5)
        fullBuffer.writeText(0, 0, 'AAA')
        fullBuffer.writeText(0, 1, 'BBB')

        // Change b
        b.text = 'CCC'

        // Incremental paint on cloned buffer
        const incBuffer = fullBuffer.clone()
        paintNodes(new Set([b]), incBuffer, styles, layout, root)

        // Full re-paint for comparison
        const freshBuffer = new CellBuffer(10, 5)
        freshBuffer.writeText(0, 0, 'AAA')
        freshBuffer.writeText(0, 1, 'CCC')

        // They should match
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 10; c++) {
                const inc = incBuffer.getCell(c, r)!
                const fresh = freshBuffer.getCell(c, r)!
                assert.equal(inc.char, fresh.char, `mismatch at (${c},${r}): ${inc.char} vs ${fresh.char}`)
            }
        }
    })

    it('clears old area when text shrinks', () => {
        const root = new TermNode('element', 'root')
        const text = new TermNode('text', 'Hello World')
        root.insertBefore(text, null)

        const styles = new Map<number, ResolvedStyle>()
        styles.set(root.id, defaultStyle('div'))

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 20, height: 1 })
        layout.set(text.id, { x: 0, y: 0, width: 11, height: 1 })

        const buffer = new CellBuffer(20, 3)
        buffer.writeText(0, 0, 'Hello World')

        // Cache old layout box before changing text
        text.cache.layoutBox = { x: 0, y: 0, width: 11, height: 1 }

        // Shrink text
        text.text = 'Hi'
        layout.set(text.id, { x: 0, y: 0, width: 2, height: 1 })

        paintNodes(new Set([text]), buffer, styles, layout, root)

        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(1, 0)?.char, 'i')
        // Old area should be cleared
        assert.equal(buffer.getCell(2, 0)?.char, ' ')
        assert.equal(buffer.getCell(10, 0)?.char, ' ')
    })
})
