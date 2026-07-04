import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AnimationClock } from '../src/render/animation-clock.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { TermNode } from '../src/renderer/node.js'

const NO_KEYFRAMES = new Map()

function makeTree(css: string, initialClass: string) {
    const root = new TermNode('element', 'root')
    const el = new TermNode('element', 'div')
    el.attributes.set('class', initialClass)
    root.insertBefore(el, null)
    const sheet = parseCSS(css)
    return { root, el, sheet }
}

describe('transition parsing', () => {

    it('parses the transition shorthand', () => {
        const { root, el, sheet } = makeTree('.box { transition: color 200ms; }', 'box')
        const style = resolveStyles(root, sheet).get(el.id)!
        assert.equal(style.transitionProperty, 'color')
        assert.equal(style.transitionDuration, 200)
    })

    it('parses longhands and seconds', () => {
        const { root, el, sheet } = makeTree('.box { transition-property: all; transition-duration: 0.3s; }', 'box')
        const style = resolveStyles(root, sheet).get(el.id)!
        assert.equal(style.transitionProperty, 'all')
        assert.equal(style.transitionDuration, 300)
    })
})

describe('transitions via the animation clock', () => {

    const CSS = `
    .box { color: red; transition: color 1000ms; }
    .box.alt { color: blue; }
    `

    function restyleTo(clock: AnimationClock, root: TermNode, el: TermNode, sheet: any, className: string) {
        el.attributes.set('class', className)
        const styles = resolveStyles(root, sheet)
        clock.sync(root, styles, NO_KEYFRAMES)
        clock.syncTransitions(root, styles)
        return styles
    }

    it('does not transition the initial style', () => {
        const { root, el, sheet } = makeTree(CSS, 'box')
        const clock = new AnimationClock(() => 0)
        const styles = restyleTo(clock, root, el, sheet, 'box')
        assert.deepEqual(clock.apply(styles), [])
        clock.stop()
        assert.equal(styles.get(el.id)?.fg, 'red')
    })

    it('interpolates a colour change over the duration', () => {
        let now = 0
        const { root, el, sheet } = makeTree(CSS, 'box')
        const clock = new AnimationClock(() => now)
        restyleTo(clock, root, el, sheet, 'box')

        now = 100
        const styles = restyleTo(clock, root, el, sheet, 'box alt')
        now = 600 // halfway through the 1000ms transition started at t=100
        clock.apply(styles)
        clock.stop()
        assert.equal(styles.get(el.id)?.fg, '#670077')
    })

    it('reaches the target and prunes when finished', () => {
        let now = 0
        const { root, el, sheet } = makeTree(CSS, 'box')
        const clock = new AnimationClock(() => now)
        restyleTo(clock, root, el, sheet, 'box')

        now = 100
        const styles = restyleTo(clock, root, el, sheet, 'box alt')
        now = 1200
        clock.apply(styles)
        clock.stop()
        assert.equal(styles.get(el.id)?.fg, 'blue')
        assert.deepEqual(clock.apply(styles), [])
    })

    it('does not transition properties outside the listed set', () => {
        let now = 0
        const css = `
        .box { color: red; width: 4cell; transition: color 1000ms; }
        .box.alt { color: red; width: 10cell; }
        `
        const { root, el, sheet } = makeTree(css, 'box')
        const clock = new AnimationClock(() => now)
        restyleTo(clock, root, el, sheet, 'box')

        now = 100
        const styles = restyleTo(clock, root, el, sheet, 'box alt')
        clock.stop()
        assert.equal(styles.get(el.id)?.width, 10) // jumped straight to target
        assert.deepEqual(clock.apply(styles), [])
    })

    it('interpolates width and flags the node as layout-dirty', () => {
        let now = 0
        const css = `
        .box { width: 0cell; transition: width 1000ms; }
        .box.alt { width: 10cell; }
        `
        const { root, el, sheet } = makeTree(css, 'box')
        const clock = new AnimationClock(() => now)
        restyleTo(clock, root, el, sheet, 'box')

        now = 0
        const styles = restyleTo(clock, root, el, sheet, 'box alt')
        now = 500
        const dirty = clock.apply(styles)
        clock.stop()
        assert.equal(styles.get(el.id)?.width, 5)
        assert.equal(dirty.length, 1)
        assert.equal(dirty[0].touchesLayout, true)
    })

    it('transition: all covers colour changes', () => {
        let now = 0
        const css = `
        .box { color: red; transition: all 1000ms; }
        .box.alt { color: blue; }
        `
        const { root, el, sheet } = makeTree(css, 'box')
        const clock = new AnimationClock(() => now)
        restyleTo(clock, root, el, sheet, 'box')

        now = 0
        const styles = restyleTo(clock, root, el, sheet, 'box alt')
        now = 500
        clock.apply(styles)
        clock.stop()
        assert.equal(styles.get(el.id)?.fg, '#670077')
    })
})
