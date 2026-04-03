import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMediaQuery } from '../src/css/media.js'
import type { MediaContext } from '../src/css/media.js'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

const termCtx: MediaContext = { colorScheme: 'dark', displayMode: 'terminal', width: 80, height: 24 }

describe('compound media queries', () => {

    it('and: both conditions must match', () => {
        assert.ok(evaluateMediaQuery('min-width: 60 and display-mode: terminal', termCtx))
    })

    it('and: fails when one condition does not match', () => {
        assert.ok(!evaluateMediaQuery('min-width: 100 and display-mode: terminal', termCtx))
    })

    it('compound media query applies style', () => {
        const root = new TermNode('element', 'root')
        const css = '@media (min-width: 60) and (display-mode: terminal) { .t { color: cyan; } }'
        const sheet = parseCSS(css)
        const el = new TermNode('element', 'span')
        el.attributes.set('class', 't')
        const text = new TermNode('text', 'Hi')
        el.insertBefore(text, null)
        root.insertBefore(el, null)
        const styles = resolveStyles(root, sheet, termCtx)
        assert.equal(styles.get(el.id)?.fg, 'cyan')
    })
})

describe('visibility: hidden', () => {

    it('hidden element takes space but does not render content', () => {
        const root = new TermNode('element', 'root')
        const css = '.hidden{visibility:hidden;width:10cell;height:3cell}.visible{color:cyan}'
        const sheet = parseCSS(css)

        const hidden = new TermNode('element', 'div')
        hidden.attributes.set('class', 'hidden')
        const t1 = new TermNode('text', 'Secret')
        hidden.insertBefore(t1, null)
        root.insertBefore(hidden, null)

        const visible = new TermNode('element', 'div')
        visible.attributes.set('class', 'visible')
        const t2 = new TermNode('text', 'Shown')
        visible.insertBefore(t2, null)
        root.insertBefore(visible, null)

        const styles = resolveStyles(root, sheet, termCtx)
        const layout = computeLayout(root, styles, 40, 10)
        const buffer = new CellBuffer(40, 10)
        paint(root, buffer, styles, layout)

        // Hidden element takes space — "Shown" starts below it
        assert.equal(buffer.getCell(0, 0)?.char, ' ') // hidden: no text
        assert.equal(buffer.getCell(0, 3)?.char, 'S') // visible: after hidden's 3-row space
    })
})

describe('white-space inheritance', () => {

    it('white-space inherits from parent to child', () => {
        const root = new TermNode('element', 'root')
        const css = '.nowrap{white-space:nowrap;width:5cell;overflow:hidden;text-overflow:ellipsis}'
        const sheet = parseCSS(css)

        const parent = new TermNode('element', 'div')
        parent.attributes.set('class', 'nowrap')
        const child = new TermNode('element', 'span')
        const text = new TermNode('text', 'Hello World')
        child.insertBefore(text, null)
        parent.insertBefore(child, null)
        root.insertBefore(parent, null)

        const styles = resolveStyles(root, sheet, termCtx)
        const layout = computeLayout(root, styles, 40, 10)
        const buffer = new CellBuffer(40, 10)
        paint(root, buffer, styles, layout)

        // Text should be truncated with ellipsis at parent width
        assert.equal(buffer.getCell(4, 0)?.char, '…')
    })
})
