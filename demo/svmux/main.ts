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

// 9450 keeps the E2E scenario clear of the other demos' debug ports
run(App, { css, debug: true, debugPort: 9450 })
