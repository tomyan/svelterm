import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { scaffoldProject } from '../src/cli/init.js'

function scaffolded(name = 'my-app'): { dir: string; cleanup: () => void } {
    const parent = mkdtempSync(path.join(tmpdir(), 'svelterm-init-'))
    const dir = path.join(parent, name)
    scaffoldProject(dir)
    return { dir, cleanup: () => rmSync(parent, { recursive: true }) }
}

describe('scaffoldProject', () => {

    it('creates the project files', () => {
        // When
        const { dir, cleanup } = scaffolded()

        // Then
        for (const file of [
            'package.json', 'vite.config.ts', 'src/App.svelte', 'src/main.css',
            '.gitignore', 'README.md',
        ]) {
            assert.ok(existsSync(path.join(dir, file)), `${file} missing`)
        }
        cleanup()
    })

    it('names the package after the directory', () => {
        // When
        const { dir, cleanup } = scaffolded('terminal-thing')

        // Then
        const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
        assert.equal(pkg.name, 'terminal-thing')
        assert.equal(pkg.type, 'module')
        assert.ok(pkg.scripts.dev)
        assert.ok(pkg.scripts.build)
        cleanup()
    })

    it('wires the svelterm vite helpers into the config', () => {
        // When
        const { dir, cleanup } = scaffolded()

        // Then
        const config = readFileSync(path.join(dir, 'vite.config.ts'), 'utf8')
        assert.ok(config.includes('svelterm.terminalServer('))
        assert.ok(config.includes('svelterm.environments()'))
        cleanup()
    })

    it('refuses to scaffold into a non-empty directory', () => {
        // Given
        const { dir, cleanup } = scaffolded()

        // Then
        assert.throws(() => scaffoldProject(dir), /not empty/)
        cleanup()
    })
})
