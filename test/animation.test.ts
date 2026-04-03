import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCSS } from '../src/css/parser.js'
import { getKeyframes } from '../src/css/animation.js'
import { resolveStyles } from '../src/css/compute.js'
import { TermNode } from '../src/renderer/node.js'

describe('@keyframes parsing', () => {

    it('parses @keyframes with from/to', () => {
        const sheet = parseCSS('@keyframes fade { from { color: red; } to { color: blue; } }')
        const kf = getKeyframes(sheet)
        assert.ok(kf.get('fade'))
        assert.equal(kf.get('fade')!.length, 2)
        assert.equal(kf.get('fade')![0].offset, 0) // from
        assert.equal(kf.get('fade')![1].offset, 1) // to
        assert.equal(kf.get('fade')![0].declarations[0].property, 'color')
    })

    it('parses @keyframes with percentages', () => {
        const sheet = parseCSS('@keyframes pulse { 0% { color: red; } 50% { color: green; } 100% { color: blue; } }')
        const kf = getKeyframes(sheet)
        assert.ok(kf.get('pulse'))
        assert.equal(kf.get('pulse')!.length, 3)
        assert.equal(kf.get('pulse')![0].offset, 0)
        assert.equal(kf.get('pulse')![1].offset, 0.5)
        assert.equal(kf.get('pulse')![2].offset, 1)
    })
})

describe('animation property', () => {

    it('animation property is parsed on resolved style', () => {
        const root = new TermNode('element', 'root')
        const css = '.spinner { animation: spin 1s infinite; }'
        const sheet = parseCSS(css)
        const el = new TermNode('element', 'div')
        el.attributes.set('class', 'spinner')
        root.insertBefore(el, null)
        const styles = resolveStyles(root, sheet)
        const style = styles.get(el.id)!
        assert.equal(style.animationName, 'spin')
        assert.equal(style.animationDuration, 1000)
        assert.equal(style.animationIterationCount, Infinity)
    })

    it('animation: none clears animation', () => {
        const root = new TermNode('element', 'root')
        const css = '.box { animation: none; }'
        const sheet = parseCSS(css)
        const el = new TermNode('element', 'div')
        el.attributes.set('class', 'box')
        root.insertBefore(el, null)
        const styles = resolveStyles(root, sheet)
        assert.equal(styles.get(el.id)?.animationName, null)
    })
})
