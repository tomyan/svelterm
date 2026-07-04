import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { quantizeTo256, quantizeTo16 } from '../src/render/color-depth.js'
import { fgColor, bgColor, setColorDepth } from '../src/render/ansi.js'

describe('quantizeTo256', () => {

    it('maps pure primaries to the colour cube', () => {
        assert.equal(quantizeTo256('#ff0000'), 196)
        assert.equal(quantizeTo256('#00ff00'), 46)
        assert.equal(quantizeTo256('#0000ff'), 21)
    })

    it('maps near-greys to the grey ramp', () => {
        const grey = quantizeTo256('#808080')
        assert.ok(grey >= 232, `expected grey ramp, got ${grey}`)
    })

    it('maps black and white to the cube extremes', () => {
        assert.equal(quantizeTo256('#000000'), 16)
        assert.equal(quantizeTo256('#ffffff'), 231)
    })
})

describe('quantizeTo16', () => {

    it('maps saturated colours to their ANSI names', () => {
        assert.equal(quantizeTo16('#cd0000'), 'red')
        assert.equal(quantizeTo16('#00cd00'), 'green')
        assert.equal(quantizeTo16('#0000ee'), 'blue')
    })

    it('maps dark shades to black and light to white', () => {
        assert.equal(quantizeTo16('#111111'), 'black')
        assert.equal(quantizeTo16('#eeeeee'), 'white')
    })
})

describe('depth-aware SGR emission', () => {

    it('truecolor emits 38;2', () => {
        setColorDepth('truecolor')
        assert.equal(fgColor('#ff0000'), '\x1b[38;2;255;0;0m')
    })

    it('256 quantizes hex to 38;5', () => {
        setColorDepth('256')
        assert.equal(fgColor('#ff0000'), '\x1b[38;5;196m')
        assert.equal(bgColor('#0000ff'), '\x1b[48;5;21m')
    })

    it('16 quantizes hex to a named SGR code', () => {
        setColorDepth('16')
        assert.equal(fgColor('#cd0000'), '\x1b[31m')
        assert.equal(bgColor('#00cd00'), '\x1b[42m')
    })

    it('mono drops colour entirely but keeps names for the reset path', () => {
        setColorDepth('mono')
        assert.equal(fgColor('#ff0000'), '')
        assert.equal(fgColor('red'), '')
        assert.equal(fgColor('default'), '\x1b[39m')
        setColorDepth('truecolor')
    })

    it('ANSI names pass through at every colour depth', () => {
        setColorDepth('16')
        assert.equal(fgColor('red'), '\x1b[31m')
        setColorDepth('256')
        assert.equal(fgColor('red'), '\x1b[31m')
        setColorDepth('truecolor')
        assert.equal(fgColor('red'), '\x1b[31m')
    })
})
