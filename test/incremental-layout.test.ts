import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { computeLayoutIncremental } from '../src/layout/incremental.js'
import type { LayoutBox } from '../src/layout/engine.js'

describe('incremental layout', () => {

    it('reuses cached layout when nothing changed', () => {
        // Given
        const root = new TermNode('element', 'root')
        const css = '.box{width:20cell;height:5cell}'
        const sheet = parseCSS(css)
        const el = new TermNode('element', 'div')
        el.attributes.set('class', 'box')
        const text = new TermNode('text', 'Hello')
        el.insertBefore(text, null)
        root.insertBefore(el, null)
        const styles = resolveStyles(root, sheet)

        // When: full layout then incremental with no dirty nodes
        const fullLayout = computeLayout(root, styles, 40, 10)
        cacheLayoutOnNodes(root, fullLayout)

        let layoutCount = 0
        const incLayout = computeLayoutIncremental(
            root, styles, fullLayout, new Set(), 40, 10,
            () => { layoutCount++ },
        )

        // Then: no re-layout, same boxes
        assert.equal(layoutCount, 0)
        assert.deepEqual(incLayout.get(el.id), fullLayout.get(el.id))
    })

    it('re-layouts dirty subtree only', () => {
        // Given
        const root = new TermNode('element', 'root')
        const css = '.a{width:20cell;height:3cell}.b{width:20cell;height:3cell}'
        const sheet = parseCSS(css)

        const a = new TermNode('element', 'div')
        a.attributes.set('class', 'a')
        const ta = new TermNode('text', 'AAA')
        a.insertBefore(ta, null)
        root.insertBefore(a, null)

        const b = new TermNode('element', 'div')
        b.attributes.set('class', 'b')
        const tb = new TermNode('text', 'BBB')
        b.insertBefore(tb, null)
        root.insertBefore(b, null)

        const styles = resolveStyles(root, sheet)
        const fullLayout = computeLayout(root, styles, 40, 10)
        cacheLayoutOnNodes(root, fullLayout)

        // When: only mark 'a' subtree dirty
        let layoutCount = 0
        const incLayout = computeLayoutIncremental(
            root, styles, fullLayout, new Set([a]), 40, 10,
            () => { layoutCount++ },
        )

        // Then: a was re-laid-out, b was not
        assert.ok(layoutCount > 0, 'some re-layout happened')
        // Both should have valid layout
        assert.ok(incLayout.get(a.id))
        assert.ok(incLayout.get(b.id))
    })

    it('bubbles layout when auto-sized parent changes', () => {
        // Given
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('')
        const parent = new TermNode('element', 'div')
        const text = new TermNode('text', 'Short')
        parent.insertBefore(text, null)
        root.insertBefore(parent, null)

        const styles = resolveStyles(root, sheet)
        const fullLayout = computeLayout(root, styles, 40, 10)
        cacheLayoutOnNodes(root, fullLayout)

        const oldParentWidth = fullLayout.get(parent.id)!.width

        // When: text changes to longer — parent must grow
        text.text = 'Much longer text here'
        const incLayout = computeLayoutIncremental(
            root, styles, fullLayout, new Set([text]), 40, 10,
        )

        // Then: parent width should change
        const newParentWidth = incLayout.get(parent.id)!.width
        assert.ok(newParentWidth > oldParentWidth, `parent should grow: ${oldParentWidth} → ${newParentWidth}`)
    })
})

function cacheLayoutOnNodes(node: TermNode, layout: Map<number, LayoutBox>): void {
    const box = layout.get(node.id)
    if (box) node.cache.layoutBox = box
    for (const child of node.children) {
        cacheLayoutOnNodes(child, layout)
    }
}
