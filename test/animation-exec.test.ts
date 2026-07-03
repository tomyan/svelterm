import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AnimationRunner } from '../src/css/animation-runner.js'
import type { KeyframeStop } from '../src/css/parser.js'
import { defaultStyle } from '../src/css/compute.js'

describe('AnimationRunner', () => {

    const keyframes: KeyframeStop[] = [
        { offset: 0, declarations: [{ property: 'color', value: 'red' }] },
        { offset: 1, declarations: [{ property: 'color', value: 'blue' }] },
    ]

    it('applies first keyframe at time 0', () => {
        const runner = new AnimationRunner(keyframes, 1000, 1)
        const style = defaultStyle('div')
        runner.apply(style, 0)
        assert.equal(style.fg, 'red')
    })

    it('applies last keyframe at end', () => {
        const runner = new AnimationRunner(keyframes, 1000, 1)
        const style = defaultStyle('div')
        runner.apply(style, 1000)
        assert.equal(style.fg, 'blue')
    })

    it('interpolates colour between keyframes', () => {
        const runner = new AnimationRunner(keyframes, 1000, 1)
        const style = defaultStyle('div')
        runner.apply(style, 500)
        assert.equal(style.fg, '#670077') // halfway from ANSI red to ANSI blue
    })

    it('interpolates within the segment bounded by surrounding stops', () => {
        const stops: KeyframeStop[] = [
            { offset: 0, declarations: [{ property: 'color', value: '#000000' }] },
            { offset: 0.5, declarations: [{ property: 'color', value: '#ffffff' }] },
            { offset: 1, declarations: [{ property: 'color', value: '#000000' }] },
        ]
        const runner = new AnimationRunner(stops, 1000, 1)
        const style = defaultStyle('div')
        runner.apply(style, 250) // halfway through the 0 → 0.5 segment
        assert.equal(style.fg, '#808080')
    })

    it('holds the last stop beyond its offset', () => {
        const stops: KeyframeStop[] = [
            { offset: 0, declarations: [{ property: 'color', value: 'red' }] },
            { offset: 0.5, declarations: [{ property: 'color', value: 'blue' }] },
        ]
        const runner = new AnimationRunner(stops, 1000, 1)
        const style = defaultStyle('div')
        runner.apply(style, 800)
        assert.equal(style.fg, 'blue')
    })

    it('switches unmixable colours discretely at the segment midpoint', () => {
        const stops: KeyframeStop[] = [
            { offset: 0, declarations: [{ property: 'color', value: 'red' }] },
            { offset: 1, declarations: [{ property: 'color', value: 'transparent' }] },
        ]
        const runner = new AnimationRunner(stops, 1000, 1)
        const style = defaultStyle('div')
        runner.apply(style, 400)
        assert.equal(style.fg, 'red')
        runner.apply(style, 600)
        assert.equal(style.fg, 'default')
    })

    it('switches boolean properties discretely at the segment midpoint', () => {
        const stops: KeyframeStop[] = [
            { offset: 0, declarations: [{ property: 'font-weight', value: 'bold' }] },
            { offset: 1, declarations: [{ property: 'font-weight', value: 'normal' }] },
        ]
        const runner = new AnimationRunner(stops, 1000, 1)
        const style = defaultStyle('div')
        runner.apply(style, 400)
        assert.equal(style.bold, true)
        runner.apply(style, 600)
        assert.equal(style.bold, false)
    })

    it('holds a property declared only in the earlier stop', () => {
        const stops: KeyframeStop[] = [
            { offset: 0, declarations: [{ property: 'color', value: 'red' }, { property: 'font-weight', value: 'bold' }] },
            { offset: 1, declarations: [{ property: 'color', value: 'blue' }] },
        ]
        const runner = new AnimationRunner(stops, 1000, 1)
        const style = defaultStyle('div')
        runner.apply(style, 400)
        assert.equal(style.bold, true)
    })

    it('infinite iteration loops', () => {
        const runner = new AnimationRunner(keyframes, 1000, Infinity)
        const style = defaultStyle('div')
        runner.apply(style, 1500) // 1.5 iterations — at 50% of second loop
        assert.equal(style.fg, '#670077')
    })

    it('reports finished when iteration count reached', () => {
        const runner = new AnimationRunner(keyframes, 1000, 1)
        assert.equal(runner.isFinished(500), false)
        assert.equal(runner.isFinished(1000), true)
        assert.equal(runner.isFinished(1500), true)
    })

    it('infinite never finishes', () => {
        const runner = new AnimationRunner(keyframes, 1000, Infinity)
        assert.equal(runner.isFinished(999999), false)
    })
})
