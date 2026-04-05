import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'child_process'
import { existsSync } from 'fs'

const DEMOS = ['counter', 'dashboard', 'todo', 'showcase', 'keyboard-hero', 'snake']

describe('demo builds', () => {
    for (const demo of DEMOS) {
        it(`${demo} builds without errors`, () => {
            const result = execSync(`DEMO=${demo} npx vite build`, {
                cwd: process.cwd(),
                encoding: 'utf-8',
                timeout: 30000,
            })
            assert.ok(result.includes('built in'), `build output should confirm success`)
            assert.ok(existsSync(`dist-demo/${demo}/main.js`), 'main.js should exist')
            assert.ok(existsSync(`dist-demo/${demo}/main.css`), 'main.css should exist')
        })
    }
})
