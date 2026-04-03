import { mount } from '../../src/index.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import App from './App.svelte'

// Load the extracted CSS
const __dirname = dirname(fileURLToPath(import.meta.url))
let css: string | undefined
try {
    css = readFileSync(join(__dirname, 'main.css'), 'utf-8')
} catch {
    // No CSS file available
}

mount(App, { css })
