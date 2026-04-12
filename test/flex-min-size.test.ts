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

    it('content-sized items do not shrink (min-height: auto)', () => {
        // Given: items without explicit height in a tight container
        // min-height:auto means content-sized items cannot shrink
        const root = new TermNode('element', 'root')
        const css = `.app { display:flex; flex-direction:column } .btn { border:single; width:10cell }`
        const stylesheet = parseCSS(css)
        const app = addElement(root, 'div', 'app')
        const btnA = addElement(app, 'button', 'btn', 'Inc')
        const btnB = addElement(app, 'button', 'btn', 'Dec')

        // When: layout in a container too short for both buttons
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 20, 4)

        // Then: buttons keep their content size (3 cells: border+content+border)
        const boxA = layout.get(btnA.id)!
        const boxB = layout.get(btnB.id)!
        assert.equal(boxA.height, 3, 'button A keeps content size')
        assert.equal(boxB.height, 3, 'button B keeps content size')
    })

    it('items with explicit height can shrink toward content size', () => {
        // Given: items with explicit height larger than content
        const root = new TermNode('element', 'root')
        const css = `.app { display:flex; flex-direction:column } .item { width:10cell; height:5cell }`
        const stylesheet = parseCSS(css)
        const app = addElement(root, 'div', 'app')
        const a = addElement(app, 'div', 'item', 'A')
        const b = addElement(app, 'div', 'item', 'B')

        // When: layout in container too small (needs 10, gets 6)
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 20, 6)

        // Then: items can shrink below explicit height
        const boxA = layout.get(a.id)!
        const boxB = layout.get(b.id)!
        assert.ok(boxA.height < 5, `item A should shrink from 5, got ${boxA.height}`)
        assert.ok(boxB.height < 5, `item B should shrink from 5, got ${boxB.height}`)
    })

    it('gap between items stays fixed when container is too small', () => {
        // Given: content-sized items with gap in a tight container
        const root = new TermNode('element', 'root')
        const css = `.app { display:flex; flex-direction:column; gap:1cell } .btn { border:single; width:10cell }`
        const stylesheet = parseCSS(css)
        const app = addElement(root, 'div', 'app')
        const a = addElement(app, 'button', 'btn', 'A')
        const b = addElement(app, 'button', 'btn', 'B')

        // When: layout in container too small (needs 3+0+3=6 after border collapse, gets 5)
        // Note: gap:1 is adjusted to 0 by border collapse (both buttons have borders)
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 20, 5)

        // Then: items keep their sizes and gap stays fixed — content overflows
        const boxA = layout.get(a.id)!
        const boxB = layout.get(b.id)!
        assert.equal(boxA.height, 3, 'button A keeps content size')
        assert.equal(boxB.y - (boxA.y + boxA.height), 0, 'gap:1 adjusted to 0 by border collapse')
    })
})
