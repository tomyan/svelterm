import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCSS } from '../src/css/parser.js'

describe('parseCSS', () => {

    describe('basic rules', () => {
        it('parses a single rule with one declaration', () => {
            const sheet = parseCSS('.foo { color: red; }')
            assert.equal(sheet.rules.length, 1)
            assert.deepEqual(sheet.rules[0].selectors, ['.foo'])
            assert.equal(sheet.rules[0].declarations.length, 1)
            assert.equal(sheet.rules[0].declarations[0].property, 'color')
            assert.equal(sheet.rules[0].declarations[0].value, 'red')
        })

        it('parses multiple declarations in one rule', () => {
            const sheet = parseCSS('.foo { color: red; font-weight: bold; }')
            assert.equal(sheet.rules[0].declarations.length, 2)
            assert.equal(sheet.rules[0].declarations[1].property, 'font-weight')
            assert.equal(sheet.rules[0].declarations[1].value, 'bold')
        })

        it('parses multiple rules', () => {
            const sheet = parseCSS('.foo { color: red; } .bar { color: blue; }')
            assert.equal(sheet.rules.length, 2)
            assert.deepEqual(sheet.rules[0].selectors, ['.foo'])
            assert.deepEqual(sheet.rules[1].selectors, ['.bar'])
        })
    })

    describe('selectors', () => {
        it('parses multiple selectors separated by commas', () => {
            const sheet = parseCSS('.foo, .bar { color: red; }')
            assert.deepEqual(sheet.rules[0].selectors, ['.foo', '.bar'])
        })

        it('parses element selectors', () => {
            const sheet = parseCSS('div { display: flex; }')
            assert.deepEqual(sheet.rules[0].selectors, ['div'])
        })

        it('parses compound selectors', () => {
            const sheet = parseCSS('.foo.svelte-abc123 { color: red; }')
            assert.deepEqual(sheet.rules[0].selectors, ['.foo.svelte-abc123'])
        })

        it('parses tag+class selectors', () => {
            const sheet = parseCSS('div.container { padding: 1; }')
            assert.deepEqual(sheet.rules[0].selectors, ['div.container'])
        })
    })

    describe('minified CSS', () => {
        it('parses Svelte minified output without spaces', () => {
            const css = '.greeting.svelte-1ktuf6r{color:#0ff;font-weight:700}'
            const sheet = parseCSS(css)
            assert.equal(sheet.rules.length, 1)
            assert.deepEqual(sheet.rules[0].selectors, ['.greeting.svelte-1ktuf6r'])
            assert.equal(sheet.rules[0].declarations[0].value, '#0ff')
            assert.equal(sheet.rules[0].declarations[1].value, '700')
        })

        it('parses multiple minified rules', () => {
            const css = '.a{color:red}.b{color:blue}.c{color:green}'
            const sheet = parseCSS(css)
            assert.equal(sheet.rules.length, 3)
        })
    })

    describe('comments', () => {
        it('skips CSS comments', () => {
            const css = '/* comment */ .foo { color: red; }'
            const sheet = parseCSS(css)
            assert.equal(sheet.rules.length, 1)
            assert.deepEqual(sheet.rules[0].selectors, ['.foo'])
        })

        it('skips Vite trailer comment', () => {
            const css = '.foo{color:red}\n/*$vite$:1*/'
            const sheet = parseCSS(css)
            assert.equal(sheet.rules.length, 1)
        })

        it('skips inline comments between rules', () => {
            const css = '.a{color:red}/* mid */.b{color:blue}'
            const sheet = parseCSS(css)
            assert.equal(sheet.rules.length, 2)
        })
    })

    describe('values', () => {
        it('preserves values with px units', () => {
            const sheet = parseCSS('.foo { width: 20px; }')
            assert.equal(sheet.rules[0].declarations[0].value, '20px')
        })

        it('preserves percentage values', () => {
            const sheet = parseCSS('.foo { width: 50%; }')
            assert.equal(sheet.rules[0].declarations[0].value, '50%')
        })

        it('handles multi-value shorthand', () => {
            const sheet = parseCSS('.foo { padding: 1px 2px; }')
            assert.equal(sheet.rules[0].declarations[0].value, '1px 2px')
        })

        it('handles values with parentheses', () => {
            const sheet = parseCSS('.foo { width: calc(100% - 10px); }')
            assert.equal(sheet.rules[0].declarations[0].value, 'calc(100% - 10px)')
        })
    })

    describe('edge cases', () => {
        it('returns empty rules for empty input', () => {
            const sheet = parseCSS('')
            assert.equal(sheet.rules.length, 0)
        })

        it('returns empty rules for whitespace-only input', () => {
            const sheet = parseCSS('   \n  \t  ')
            assert.equal(sheet.rules.length, 0)
        })

        it('returns empty rules for comment-only input', () => {
            const sheet = parseCSS('/* nothing here */')
            assert.equal(sheet.rules.length, 0)
        })

        it('handles trailing semicolon in declarations', () => {
            const sheet = parseCSS('.foo { color: red; }')
            assert.equal(sheet.rules[0].declarations.length, 1)
        })

        it('handles missing trailing semicolon', () => {
            const sheet = parseCSS('.foo { color: red }')
            assert.equal(sheet.rules[0].declarations.length, 1)
            assert.equal(sheet.rules[0].declarations[0].value, 'red')
        })
    })
})
