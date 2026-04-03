import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeSpecificity } from '../src/css/specificity.js'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 40, height = 5) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return buffer
}

describe('computeSpecificity', () => {

    it('element selector has specificity (0,0,1)', () => {
        assert.deepEqual(computeSpecificity('div'), [0, 0, 1])
    })

    it('class selector has specificity (0,1,0)', () => {
        assert.deepEqual(computeSpecificity('.foo'), [0, 1, 0])
    })

    it('id selector has specificity (1,0,0)', () => {
        assert.deepEqual(computeSpecificity('#main'), [1, 0, 0])
    })

    it('compound class selectors add up', () => {
        assert.deepEqual(computeSpecificity('.foo.bar'), [0, 2, 0])
    })

    it('element + class', () => {
        assert.deepEqual(computeSpecificity('div.foo'), [0, 1, 1])
    })

    it(':root pseudo-class counts as class', () => {
        assert.deepEqual(computeSpecificity(':root'), [0, 1, 0])
    })

    it(':focus pseudo-class counts as class', () => {
        assert.deepEqual(computeSpecificity('.btn:focus'), [0, 2, 0])
    })

    it('Svelte scoped hash is a class', () => {
        assert.deepEqual(computeSpecificity('.foo.svelte-abc123'), [0, 2, 0])
    })
})

describe('specificity in cascade', () => {

    it('class beats element regardless of source order', () => {
        // Element rule comes AFTER class rule — but class should still win
        const buffer = render(
            '.highlight{color:green}div{color:red}',
            (root) => {
                const el = new TermNode('element', 'div')
                el.attributes.set('class', 'highlight')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
    })

    it('id beats class regardless of source order', () => {
        const buffer = render(
            '.foo{color:red}#main{color:blue}',
            (root) => {
                const el = new TermNode('element', 'div')
                el.attributes.set('class', 'foo')
                el.attributes.set('id', 'main')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'blue')
    })

    it('equal specificity: later rule wins', () => {
        const buffer = render(
            '.a{color:red}.b{color:blue}',
            (root) => {
                const el = new TermNode('element', 'div')
                el.attributes.set('class', 'a b')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'blue')
    })

    it('more specific compound selector wins', () => {
        const buffer = render(
            '.foo{color:red}div.foo{color:green}',
            (root) => {
                const el = new TermNode('element', 'div')
                el.attributes.set('class', 'foo')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
    })
})
