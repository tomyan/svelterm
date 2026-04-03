import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'

describe('border side edge cases', () => {

    it('border:single then border-left:false disables only left', () => {
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('.box{border:single;border-left:false}')
        const el = new TermNode('element', 'div')
        el.attributes.set('class', 'box')
        root.insertBefore(el, null)
        const s = resolveStyles(root, sheet).get(el.id)!
        assert.equal(s.borderTop, true)
        assert.equal(s.borderRight, true)
        assert.equal(s.borderBottom, true)
        assert.equal(s.borderLeft, false)
    })

    it('border-top:true and border-left:true enables only those two', () => {
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('.box{border-style:single;border-top:true;border-left:true}')
        const el = new TermNode('element', 'div')
        el.attributes.set('class', 'box')
        root.insertBefore(el, null)
        const s = resolveStyles(root, sheet).get(el.id)!
        assert.equal(s.borderTop, true)
        assert.equal(s.borderRight, false)
        assert.equal(s.borderBottom, false)
        assert.equal(s.borderLeft, true)
    })

    it('border:single enables all sides', () => {
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('.box{border:single}')
        const el = new TermNode('element', 'div')
        el.attributes.set('class', 'box')
        root.insertBefore(el, null)
        const s = resolveStyles(root, sheet).get(el.id)!
        assert.equal(s.borderTop, true)
        assert.equal(s.borderRight, true)
        assert.equal(s.borderBottom, true)
        assert.equal(s.borderLeft, true)
    })
})
