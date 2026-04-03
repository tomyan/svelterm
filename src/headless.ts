import type { Component, ComponentType, SvelteComponent } from 'svelte'
import { createTermRenderer, TermNode } from './renderer/index.js'
import { CellBuffer } from './render/buffer.js'
import { paint } from './render/paint.js'
import { parseCSS } from './css/parser.js'
import { resolveStyles } from './css/compute.js'
import { computeLayout } from './layout/engine.js'
import type { CSSStyleSheet } from './css/parser.js'

export interface RenderResult {
    buffer: CellBuffer
    root: TermNode
    unmount: () => void
}

/**
 * Render a Svelte component headlessly (no terminal) for testing.
 * Returns the cell buffer, virtual tree, and unmount function.
 */
export function renderHeadless<Props extends Record<string, any>>(
    AppComponent: ComponentType<SvelteComponent<Props>> | Component<Props>,
    options: {
        width?: number
        height?: number
        css?: string
        props?: Props
    } = {},
): RenderResult {
    const width = options.width ?? 80
    const height = options.height ?? 24

    const renderer = createTermRenderer()
    const root = new TermNode('element', 'root')

    const stylesheet = options.css ? parseCSS(options.css) : null

    const { unmount } = renderer.render(
        AppComponent as any,
        { target: root, props: options.props ?? {} as any },
    )

    const buffer = new CellBuffer(width, height)
    const styles = stylesheet ? resolveStyles(root, stylesheet) : undefined
    const layout = styles ? computeLayout(root, styles, width, height) : undefined
    paint(root, buffer, styles, layout)

    return { buffer, root, unmount }
}

export { bufferToText, bufferToStyledText, bufferToSvg } from './render/snapshot.js'
export { CellBuffer } from './render/buffer.js'
export { TermNode } from './renderer/node.js'
