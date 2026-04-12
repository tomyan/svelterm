import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'

function addElement(parent: TermNode, tag: string, cls: string, text?: string): TermNode {
    const el = new TermNode('element', tag)
    el.attributes.set('class', cls)
    if (text) el.insertBefore(new TermNode('text', text), null)
    parent.insertBefore(el, null)
    return el
}

describe('flex minimum size for bordered elements', () => {

    it('bordered buttons do not shrink below 3 cells tall', () => {
        // Given: a flex column with bordered buttons in a small container
        const root = new TermNode('element', 'root')
        const css = `.app { display:flex; flex-direction:column } .btn { border:single; width:10cell; height:3cell }`
        const stylesheet = parseCSS(css)
        const app = addElement(root, 'div', 'app')
        const btnA = addElement(app, 'button', 'btn', 'Inc')
        const btnB = addElement(app, 'button', 'btn', 'Dec')

        // When: layout in a container too short for both buttons (5 rows for 2x3-cell buttons)
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 20, 5)

        // Then: buttons should not shrink below 3 cells
        const boxA = layout.get(btnA.id)!
        const boxB = layout.get(btnB.id)!
        assert.ok(boxA.height >= 3, `button A height should be >= 3, got ${boxA.height}`)
        assert.ok(boxB.height >= 3, `button B height should be >= 3, got ${boxB.height}`)
    })

    it('non-bordered elements can shrink to 0', () => {
        // Given: plain divs in a tight container
        const root = new TermNode('element', 'root')
        const css = `.app { display:flex; flex-direction:column } .item { width:10cell; height:5cell }`
        const stylesheet = parseCSS(css)
        const app = addElement(root, 'div', 'app')
        const a = addElement(app, 'div', 'item', 'A')
        const b = addElement(app, 'div', 'item', 'B')

        // When: layout in very small container
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 20, 3)

        // Then: items can shrink below 3
        const boxA = layout.get(a.id)!
        assert.ok(boxA.height < 5, `should have shrunk from 5`)
    })
})
