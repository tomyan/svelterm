import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { resolveStylesIncremental } from '../src/css/incremental.js'
import type { ResolvedStyle } from '../src/css/compute.js'

describe('incremental style resolution', () => {

    it('re-resolves only dirty nodes', () => {
        const root = new TermNode('element', 'root')
        const css = '.red{color:red}.blue{color:blue}'
        const sheet = parseCSS(css)

        const a = new TermNode('element', 'div')
        a.attributes.set('class', 'red')
        root.insertBefore(a, null)

        const b = new TermNode('element', 'div')
        b.attributes.set('class', 'blue')
        root.insertBefore(b, null)

        // Initial full resolve
        const styles = resolveStyles(root, sheet)
        assert.equal(styles.get(a.id)?.fg, 'red')
        assert.equal(styles.get(b.id)?.fg, 'blue')

        // Cache styles on nodes
        for (const [id, style] of styles) {
            const node = findNode(root, id)
            if (node) node.cache.resolvedStyle = style
        }

        // Change only node a's class
        a.attributes.set('class', 'blue')
        const dirtyNodes = new Set([a])

        // Incremental resolve
        let resolveCount = 0
        const newStyles = resolveStylesIncremental(root, sheet, styles, dirtyNodes, () => { resolveCount++ })

        // a should be re-resolved to blue
        assert.equal(newStyles.get(a.id)?.fg, 'blue')
        // b should be unchanged (cached)
        assert.equal(newStyles.get(b.id)?.fg, 'blue')
        // Only the dirty node was resolved
        assert.ok(resolveCount > 0 && resolveCount < 10, `expected few resolves, got ${resolveCount}`)
    })

    it('detects layout-affecting style changes', () => {
        const root = new TermNode('element', 'root')
        const css = '.small{width:10cell}.big{width:20cell}'
        const sheet = parseCSS(css)

        const el = new TermNode('element', 'div')
        el.attributes.set('class', 'small')
        root.insertBefore(el, null)

        const styles = resolveStyles(root, sheet)
        const oldStyle = styles.get(el.id)!
        el.cache.resolvedStyle = oldStyle

        // Change class
        el.attributes.set('class', 'big')
        const dirtyNodes = new Set([el])

        const layoutAffected: TermNode[] = []
        resolveStylesIncremental(root, sheet, styles, dirtyNodes, () => {}, (node) => {
            layoutAffected.push(node)
        })

        assert.ok(layoutAffected.includes(el), 'width change should trigger layout')
    })

    it('uses cached style for clean nodes', () => {
        const root = new TermNode('element', 'root')
        const css = '.a{color:red}'
        const sheet = parseCSS(css)

        const el = new TermNode('element', 'div')
        el.attributes.set('class', 'a')
        root.insertBefore(el, null)

        const styles = resolveStyles(root, sheet)
        el.cache.resolvedStyle = styles.get(el.id)!

        // No dirty nodes — should reuse all cached
        const newStyles = resolveStylesIncremental(root, sheet, styles, new Set(), () => {})
        assert.equal(newStyles.get(el.id)?.fg, 'red')
    })
})

function findNode(root: TermNode, id: number): TermNode | null {
    if (root.id === id) return root
    for (const child of root.children) {
        const found = findNode(child, id)
        if (found) return found
    }
    return null
}
