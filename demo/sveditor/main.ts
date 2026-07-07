import { run } from '../../src/index.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import App from './App.svelte'

const __dirname = dirname(fileURLToPath(import.meta.url))
let css: string | undefined
try {
    css = readFileSync(join(__dirname, 'main.css'), 'utf-8')
} catch {
    // No CSS file available
}

const path = process.env.SVELTERM_EDIT_FILE ?? process.argv[2] ?? 'README.md'
const content = readFileSync(path, 'utf-8')

// 9448 keeps the E2E scenario clear of the other demos' debug ports
run(App, { css, debug: true, debugPort: 9448, props: { path, content } })
