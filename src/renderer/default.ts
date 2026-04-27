import { getContext } from 'svelte'
import { createTermRenderer } from './index.js'

const renderer: ReturnType<typeof createTermRenderer> = createTermRenderer()
export default renderer

const TARGET_KEY = Symbol.for('@svelterm/target')

/**
 * True inside a Svelte component being rendered into svelterm's cell tree
 * (i.e. mounted via svelterm's `run()`); false for plain browser-Svelte
 * mounts. Components that render structurally different output per target
 * use this to dispatch.
 */
export function isTerminal(): boolean {
    return getContext<'browser' | 'terminal'>(TARGET_KEY) === 'terminal'
}
