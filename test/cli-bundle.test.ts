import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
    withCssRegistration, bootstrapModule, findEntry, findGlobalCss,
} from '../src/cli/bundle.js'

function tempProject(): string {
    return mkdtempSync(path.join(tmpdir(), 'svelterm-build-'))
}

describe('withCssRegistration', () => {

    it('appends a registration call carrying the component CSS', () => {
        // Given
        const compiled = 'export default function App() {}'

        // When
        const code = withCssRegistration(compiled, '.x { color: red; }')

        // Then
        assert.ok(code.startsWith(compiled))
        assert.ok(code.includes('registerComponentCss'))
        assert.ok(code.includes(JSON.stringify('.x { color: red; }')))
    })

    it('returns the code unchanged when the component has no CSS', () => {
        const compiled = 'export default function App() {}'
        assert.equal(withCssRegistration(compiled, null), compiled)
        assert.equal(withCssRegistration(compiled, ''), compiled)
    })
})

describe('bootstrapModule', () => {

    it('imports the entry component and calls run()', () => {
        // When
        const code = bootstrapModule('/proj/src/App.svelte')

        // Then
        assert.ok(code.includes(`import App from ${JSON.stringify('/proj/src/App.svelte')}`))
        assert.ok(code.includes('run(App'))
    })

    it('registers global CSS before the component import so it cascades first', () => {
        // When
        const code = bootstrapModule('/proj/src/App.svelte', 'body { color: red; }')

        // Then
        const cssIndex = code.indexOf('svelterm:global-css')
        const appIndex = code.indexOf('import App')
        assert.ok(cssIndex >= 0 && cssIndex < appIndex)
    })
})

describe('findEntry', () => {

    it('prefers src/App.svelte over App.svelte', () => {
        // Given
        const dir = tempProject()
        mkdirSync(path.join(dir, 'src'))
        writeFileSync(path.join(dir, 'src/App.svelte'), '')
        writeFileSync(path.join(dir, 'App.svelte'), '')

        // Then
        assert.equal(findEntry(dir), path.join(dir, 'src/App.svelte'))
        rmSync(dir, { recursive: true })
    })

    it('falls back to App.svelte in the project root', () => {
        const dir = tempProject()
        writeFileSync(path.join(dir, 'App.svelte'), '')
        assert.equal(findEntry(dir), path.join(dir, 'App.svelte'))
        rmSync(dir, { recursive: true })
    })

    it('returns null when no conventional entry exists', () => {
        const dir = tempProject()
        assert.equal(findEntry(dir), null)
        rmSync(dir, { recursive: true })
    })
})

describe('findGlobalCss', () => {

    it('finds src/main.css then main.css', () => {
        // Given
        const dir = tempProject()
        mkdirSync(path.join(dir, 'src'))
        writeFileSync(path.join(dir, 'src/main.css'), '.a {}')

        // Then
        assert.equal(findGlobalCss(dir), path.join(dir, 'src/main.css'))
        rmSync(dir, { recursive: true })
    })

    it('returns null when there is no global stylesheet', () => {
        const dir = tempProject()
        assert.equal(findGlobalCss(dir), null)
        rmSync(dir, { recursive: true })
    })
})
