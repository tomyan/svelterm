import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseEasing } from '../src/css/easing.js'

const approx = (actual: number, expected: number, eps = 0.01) =>
    assert.ok(Math.abs(actual - expected) < eps, `expected ~${expected}, got ${actual}`)

describe('parseEasing keywords', () => {

    it('parses linear as the identity', () => {
        // Given
        const ease = parseEasing('linear')!

        // Then
        approx(ease(0), 0)
        approx(ease(0.25), 0.25)
        approx(ease(0.5), 0.5)
        approx(ease(1), 1)
    })

    it('parses ease as the CSS preset cubic-bezier(0.25, 0.1, 0.25, 1)', () => {
        // Given
        const ease = parseEasing('ease')!

        // Then: endpoints exact, midpoint from the reference curve
        approx(ease(0), 0)
        approx(ease(1), 1)
        approx(ease(0.5), 0.8, 0.02)
    })

    it('parses ease-in as slow start', () => {
        // Given
        const ease = parseEasing('ease-in')!

        // Then
        assert.ok(ease(0.25) < 0.25)
        assert.ok(ease(0.75) < 0.75)
        approx(ease(1), 1)
    })

    it('parses ease-out as fast start', () => {
        // Given
        const ease = parseEasing('ease-out')!

        // Then
        assert.ok(ease(0.25) > 0.25)
        assert.ok(ease(0.75) > 0.75)
        approx(ease(0), 0)
    })

    it('parses ease-in-out as symmetric around the midpoint', () => {
        // Given
        const ease = parseEasing('ease-in-out')!

        // Then
        assert.ok(ease(0.25) < 0.25)
        approx(ease(0.5), 0.5, 0.02)
        assert.ok(ease(0.75) > 0.75)
    })
})

describe('parseEasing cubic-bezier()', () => {

    it('evaluates an explicit cubic-bezier curve', () => {
        // Given: same control points as ease-in
        const explicit = parseEasing('cubic-bezier(0.42, 0, 1, 1)')!
        const preset = parseEasing('ease-in')!

        // Then
        for (const t of [0, 0.2, 0.5, 0.8, 1]) {
            approx(explicit(t), preset(t), 0.001)
        }
    })

    it('handles whitespace inside the arguments', () => {
        // Given
        const ease = parseEasing('cubic-bezier( 0 , 0 , 1 , 1 )')!

        // Then: linear control points give the identity
        approx(ease(0.3), 0.3)
    })

    it('rejects cubic-bezier with x outside [0, 1]', () => {
        // Then
        assert.equal(parseEasing('cubic-bezier(-1, 0, 1, 1)'), null)
        assert.equal(parseEasing('cubic-bezier(0, 0, 2, 1)'), null)
    })

    it('rejects malformed cubic-bezier', () => {
        assert.equal(parseEasing('cubic-bezier(0, 0, 1)'), null)
        assert.equal(parseEasing('cubic-bezier(a, b, c, d)'), null)
    })
})

describe('parseEasing steps()', () => {

    it('steps(4, end) holds then jumps at each quarter', () => {
        // Given
        const ease = parseEasing('steps(4, end)')!

        // Then
        assert.equal(ease(0), 0)
        assert.equal(ease(0.1), 0)
        assert.equal(ease(0.25), 0.25)
        assert.equal(ease(0.6), 0.5)
        assert.equal(ease(0.9), 0.75)
        assert.equal(ease(1), 1)
    })

    it('steps(n) defaults to end position', () => {
        // Given
        const ease = parseEasing('steps(2)')!

        // Then
        assert.equal(ease(0.4), 0)
        assert.equal(ease(0.6), 0.5)
    })

    it('steps(4, start) jumps immediately', () => {
        // Given
        const ease = parseEasing('steps(4, start)')!

        // Then
        assert.equal(ease(0.05), 0.25)
        assert.equal(ease(0.3), 0.5)
        assert.equal(ease(1), 1)
    })

    it('step-start and step-end are single-step aliases', () => {
        // Given
        const start = parseEasing('step-start')!
        const end = parseEasing('step-end')!

        // Then
        assert.equal(start(0.01), 1)
        assert.equal(end(0.99), 0)
        assert.equal(end(1), 1)
    })

    it('rejects steps with a non-positive count', () => {
        assert.equal(parseEasing('steps(0)'), null)
        assert.equal(parseEasing('steps(-2, end)'), null)
    })
})

describe('parseEasing invalid input', () => {

    it('returns null for unknown keywords', () => {
        assert.equal(parseEasing('bouncy'), null)
        assert.equal(parseEasing(''), null)
    })
})
