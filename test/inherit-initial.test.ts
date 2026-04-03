import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'

describe('inherit keyword', () => {

    it('color:inherit gets parent color', () => {
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('.parent{color:red}.child{color:inherit}')
        const parent = new TermNode('element', 'div')
        parent.attributes.set('class', 'parent')
        const child = new TermNode('element', 'span')
        child.attributes.set('class', 'child')
        parent.insertBefore(child, null)
        root.insertBefore(parent, null)
        const styles = resolveStyles(root, sheet)
        assert.equal(styles.get(child.id)?.fg, 'red')
    })
})

describe('initial keyword', () => {

    it('color:initial resets to default', () => {
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('.parent{color:red}.child{color:initial}')
        const parent = new TermNode('element', 'div')
        parent.attributes.set('class', 'parent')
        const child = new TermNode('element', 'span')
        child.attributes.set('class', 'child')
        parent.insertBefore(child, null)
        root.insertBefore(parent, null)
        const styles = resolveStyles(root, sheet)
        assert.equal(styles.get(child.id)?.fg, 'default')
    })
})

describe('unset keyword', () => {

    it('color:unset inherits (color inherits by default)', () => {
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('.parent{color:cyan}.child{color:unset}')
        const parent = new TermNode('element', 'div')
        parent.attributes.set('class', 'parent')
        const child = new TermNode('element', 'span')
        child.attributes.set('class', 'child')
        parent.insertBefore(child, null)
        root.insertBefore(parent, null)
        const styles = resolveStyles(root, sheet)
        // color inherits, so unset = inherit
        assert.equal(styles.get(child.id)?.fg, 'cyan')
    })
})
