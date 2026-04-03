import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { computeLayout } from '../src/layout/engine.js'
import { resolveStyles } from '../src/css/compute.js'
import { parseCSS } from '../src/css/parser.js'
import { syncLayoutCache } from '../src/layout/cache.js'

describe('layout cache sync', () => {

    it('syncLayoutCache populates node.cache.layoutBox from layout map', () => {
        // Given: a tree with computed layout
        const root = new TermNode('element', 'root')
        const child = new TermNode('element', 'div')
        root.insertBefore(child, null)

        const css = parseCSS('div { width: 10cell; height: 3cell; }')
        const styles = resolveStyles(root, css)
        const layout = computeLayout(root, styles, 80, 24)

        // When: sync cache
        syncLayoutCache(root, layout)

        // Then: cache reflects layout
        assert.deepEqual(root.cache.layoutBox, layout.get(root.id))
        assert.deepEqual(child.cache.layoutBox, layout.get(child.id))
    })

    it('syncLayoutCache clears cache for nodes not in layout map', () => {
        // Given: a node with stale cache
        const root = new TermNode('element', 'root')
        root.cache.layoutBox = { x: 0, y: 0, width: 50, height: 50 }

        // When: sync with empty layout
        syncLayoutCache(root, new Map())

        // Then: cache is cleared
        assert.equal(root.cache.layoutBox, null)
    })

    it('syncLayoutCache recurses into children', () => {
        // Given
        const root = new TermNode('element', 'root')
        const parent = new TermNode('element', 'div')
        const child = new TermNode('element', 'span')
        parent.insertBefore(child, null)
        root.insertBefore(parent, null)

        const boxes = new Map<number, { x: number; y: number; width: number; height: number }>()
        boxes.set(root.id, { x: 0, y: 0, width: 80, height: 24 })
        boxes.set(parent.id, { x: 0, y: 0, width: 40, height: 10 })
        boxes.set(child.id, { x: 5, y: 2, width: 20, height: 3 })

        // When
        syncLayoutCache(root, boxes)

        // Then: all nodes have correct cache
        assert.deepEqual(root.cache.layoutBox, boxes.get(root.id))
        assert.deepEqual(parent.cache.layoutBox, boxes.get(parent.id))
        assert.deepEqual(child.cache.layoutBox, boxes.get(child.id))
    })
})
