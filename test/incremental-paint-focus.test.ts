import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { CellBuffer } from '../src/render/buffer.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { resolveStylesIncremental } from '../src/css/incremental.js'
import { computeLayout } from '../src/layout/engine.js'
import { syncLayoutCache } from '../src/layout/cache.js'
import { paint } from '../src/render/paint.js'
import { paintNodes } from '../src/render/incremental-paint.js'
import { diffBuffers } from '../src/render/diff.js'

describe('incremental paint focus change', () => {

    it('unfocused button border reverts to original color', () => {
        // Given: two buttons, first one focused
        const root = new TermNode('element', 'root')
        const btnA = new TermNode('element', 'button')
        btnA.insertBefore(new TermNode('text', 'AAA'), null)
        const btnB = new TermNode('element', 'button')
        btnB.insertBefore(new TermNode('text', 'BBB'), null)
        root.insertBefore(btnA, null)
        root.insertBefore(btnB, null)

        const css = `
            button { border: single; border-color: gray; width: 8cell; height: 3cell; }
            button:focus { border-color: cyan; color: cyan; }
        `
        const stylesheet = parseCSS(css)

        // Initial render with btnA focused
        btnA.attributes.set('data-focused', 'true')
        let styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 40, 10)
        syncLayoutCache(root, layout)

        const buf1 = new CellBuffer(40, 10)
        paint(root, buf1, styles, layout)

        // Verify btnA has cyan border
        const btnAFg = buf1.getCell(0, 0)?.fg
        assert.equal(btnAFg, 'cyan')
        // Verify btnB has non-cyan border (gray resolves to #808080)
        const btnBBox = layout.get(btnB.id)!
        const btnBFg = buf1.getCell(btnBBox.x, btnBBox.y)?.fg
        assert.notEqual(btnBFg, 'cyan')

        // When: move focus from A to B
        btnA.attributes.delete('data-focused')
        btnA.invalidateStyle()
        btnB.attributes.set('data-focused', 'true')
        btnB.invalidateStyle()

        styles = resolveStylesIncremental(
            root, stylesheet, styles, new Set([btnA, btnB]),
        )

        const buf2 = buf1.clone()
        paintNodes(new Set([btnA, btnB]), buf2, styles, layout, root)

        // Then: btnA border should NOT be cyan (unfocused)
        const btnAAfter = buf2.getCell(0, 0)?.fg
        assert.notEqual(btnAAfter, 'cyan', `btnA should not be cyan after unfocus, got: ${btnAAfter}`)
        // btnB border should be cyan (focused)
        assert.equal(buf2.getCell(btnBBox.x, btnBBox.y)?.fg, 'cyan', 'btnB top-left corner should be cyan after focus')

        // Also verify diff produces output (color changed)
        const diff = diffBuffers(buf1, buf2)
        assert.ok(diff.length > 0, 'diff should detect color change')
    })

    it('full pipeline: focus change produces correct diff output', () => {
        // Given: same setup but go through the full clone+paint+diff pipeline
        const root = new TermNode('element', 'root')
        root.attributes.set('class', 'app')
        const btnA = new TermNode('element', 'button')
        btnA.insertBefore(new TermNode('text', 'Inc'), null)
        const btnB = new TermNode('element', 'button')
        btnB.insertBefore(new TermNode('text', 'Dec'), null)
        root.insertBefore(btnA, null)
        root.insertBefore(btnB, null)

        const css = `
            .app { display: flex; flex-direction: column; }
            button { border: single; border-color: gray; width: 8cell; height: 3cell; }
            button:focus { border-color: yellow; color: yellow; font-weight: bold; }
        `
        const stylesheet = parseCSS(css)

        // Step 1: Initial full render with btnA focused
        btnA.attributes.set('data-focused', 'true')
        let styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 40, 10)
        syncLayoutCache(root, layout)

        const prevBuffer = new CellBuffer(40, 10)
        paint(root, prevBuffer, styles, layout)

        // Verify initial state
        assert.equal(prevBuffer.getCell(0, 0)?.fg, 'yellow', 'btnA should be yellow initially')

        // Step 2: Move focus A→B (simulate what FocusManager does)
        btnA.attributes.delete('data-focused')
        btnA.invalidateStyle()
        btnB.attributes.set('data-focused', 'true')
        btnB.invalidateStyle()

        styles = resolveStylesIncremental(
            root, stylesheet, styles, new Set([btnA, btnB]),
        )

        // Step 3: Incremental paint on cloned buffer
        const newBuffer = prevBuffer.clone()
        paintNodes(new Set([btnA, btnB]), newBuffer, styles, layout, root)

        // Step 4: Verify
        const btnACorner = newBuffer.getCell(0, 0)
        assert.notEqual(btnACorner?.fg, 'yellow', `btnA corner should not be yellow, got: ${btnACorner?.fg}`)
        assert.equal(btnACorner?.char, '┌', 'btnA corner char should still be ┌')

        const btnBBox = layout.get(btnB.id)!
        const btnBCorner = newBuffer.getCell(btnBBox.x, btnBBox.y)
        assert.equal(btnBCorner?.fg, 'yellow', 'btnB corner should be yellow')
        assert.equal(btnBCorner?.char, '├', 'btnB corner char should be ├ (collapsed with btnA border)')
    })
})
