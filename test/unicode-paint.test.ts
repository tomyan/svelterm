import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { diffBuffers } from '../src/render/diff.js'
import { paintNodes } from '../src/render/incremental-paint.js'
import { TermNode } from '../src/renderer/node.js'
import { defaultStyle } from '../src/css/compute.js'
import type { ResolvedStyle } from '../src/css/compute.js'
import type { LayoutBox } from '../src/layout/engine.js'

function paintText(text: string, width = 10) {
    const root = new TermNode('element', 'root')
    const parent = new TermNode('element', 'div')
    const textNode = new TermNode('text', text)
    parent.insertBefore(textNode, null)
    root.insertBefore(parent, null)
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, defaultStyle('div'))
    styles.set(parent.id, { ...defaultStyle('div'), width })
    const layout = new Map<number, LayoutBox>()
    layout.set(root.id, { x: 0, y: 0, width, height: 2 })
    layout.set(parent.id, { x: 0, y: 0, width, height: 1 })
    layout.set(textNode.id, { x: 0, y: 0, width, height: 1 })
    const buffer = new CellBuffer(width, 2)
    paintNodes(new Set([textNode]), buffer, styles, layout, root)
    return buffer
}

describe('wide glyphs in the cell buffer', () => {

    it('a CJK glyph occupies two cells: glyph then continuation', () => {
        // When
        const buffer = paintText('你a')

        // Then
        assert.equal(buffer.getCell(0, 0)?.char, '你')
        assert.equal(buffer.getCell(1, 0)?.char, '')
        assert.equal(buffer.getCell(2, 0)?.char, 'a')
    })

    it('emoji graphemes stay whole in one glyph cell', () => {
        const buffer = paintText('👍x')
        assert.equal(buffer.getCell(0, 0)?.char, '👍')
        assert.equal(buffer.getCell(1, 0)?.char, '')
        assert.equal(buffer.getCell(2, 0)?.char, 'x')
    })
})

describe('diff emission with wide glyphs', () => {

    it('emits the glyph once and skips the continuation cell', () => {
        // Given
        const next = paintText('你a')

        // When
        const out = diffBuffers(null, next)

        // Then: the wide glyph appears exactly once, no empty writes
        assert.equal((out.match(/你/g) ?? []).length, 1)
        assert.ok(out.includes('a'))
    })

    it('overwriting a wide glyph with narrow text repaints both cells', () => {
        // Given
        const before = paintText('你a')
        const after = paintText('xya')

        // When
        const out = diffBuffers(before, after)

        // Then
        assert.ok(out.includes('x'))
        assert.ok(out.includes('y'))
    })
})
