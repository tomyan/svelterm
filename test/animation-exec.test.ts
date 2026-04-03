import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AnimationRunner } from '../src/css/animation-runner.js'
import type { KeyframeStop } from '../src/css/parser.js'
import type { ResolvedStyle } from '../src/css/compute.js'
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

    it('applies first keyframe at midpoint (no interpolation — discrete)', () => {
        const runner = new AnimationRunner(keyframes, 1000, 1)
        const style = defaultStyle('div')
        runner.apply(style, 500)
        // Discrete: at 50%, still on first keyframe (switches at boundary)
        assert.equal(style.fg, 'red')
    })

    it('infinite iteration loops', () => {
        const runner = new AnimationRunner(keyframes, 1000, Infinity)
        const style = defaultStyle('div')
        runner.apply(style, 1500) // 1.5 iterations — at 50% of second loop
        assert.equal(style.fg, 'red')
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
