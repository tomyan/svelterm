import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'

describe('opacity property', () => {

    it('opacity:dim sets dim flag (terminal-specific)', () => {
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('.t{opacity:dim}')
        const el = new TermNode('element', 'span')
        el.attributes.set('class', 't')
        root.insertBefore(el, null)
        const styles = resolveStyles(root, sheet)
        assert.equal(styles.get(el.id)?.dim, true)
    })

    it('opacity less than 1 sets dim flag', () => {
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('.t{opacity:0.5}')
        const el = new TermNode('element', 'span')
        el.attributes.set('class', 't')
        root.insertBefore(el, null)
        const styles = resolveStyles(root, sheet)
        assert.equal(styles.get(el.id)?.dim, true)
    })

    it('opacity:1 does not set dim', () => {
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('.t{opacity:1}')
        const el = new TermNode('element', 'span')
        el.attributes.set('class', 't')
        root.insertBefore(el, null)
        const styles = resolveStyles(root, sheet)
        assert.equal(styles.get(el.id)?.dim, false)
    })

    it('opacity:0 sets dim flag', () => {
        const root = new TermNode('element', 'root')
        const sheet = parseCSS('.t{opacity:0}')
        const el = new TermNode('element', 'span')
        el.attributes.set('class', 't')
        root.insertBefore(el, null)
        const styles = resolveStyles(root, sheet)
        assert.equal(styles.get(el.id)?.dim, true)
    })
})
