import type { Component, ComponentType, SvelteComponent } from 'svelte'
import { TermNode } from './renderer/index.js'
import renderer from './renderer/default.js'
import { CellBuffer } from './render/buffer.js'
import { diffBuffers } from './render/diff.js'
import { paint } from './render/paint.js'
import { parseCSS } from './css/parser.js'
import { resolveStyles, filterByMedia, type ResolvedStyle } from './css/compute.js'
import { resolveStylesIncremental } from './css/incremental.js'
import { computeLayout, type LayoutBox } from './layout/engine.js'
import { computeLayoutIncremental } from './layout/incremental.js'
import { syncLayoutCache } from './layout/cache.js'
import { RenderContext } from './render/context.js'
import { paintNodes } from './render/incremental-paint.js'
import { type RenderQueueSnapshot } from './render/queue.js'
import { parseKeyEvent } from './input/keyboard.js'
import { parseMouseEvent, type MouseEvent } from './input/mouse.js'
import { hitTest } from './input/hit.js'
import { FocusManager } from './input/focus.js'
import { dispatchEvent } from './input/dispatch.js'
import { TextBuffer } from './components/text-buffer.js'
import { StdinRouter, matchOSC11, parseOSC11Scheme } from './terminal/stdin-router.js'
import { DebugServer } from './debug/server.js'
import { ConsoleDomain } from './debug/console.js'
import type { CSSStyleSheet } from './css/parser.js'
import * as ansi from './render/ansi.js'
import {
    getTerminalSize,
    enterFullscreen,
    exitFullscreen,
    enableRawMode,
    disableRawMode,
    writeOutput,
} from './terminal/screen.js'

export interface MountOptions {
    fullscreen?: boolean
    css?: string
    mouse?: boolean
    debug?: boolean
    debugPort?: number
}

export function mount<Props extends Record<string, any>>(
    AppComponent: ComponentType<SvelteComponent<Props>> | Component<Props>,
    options?: MountOptions & ({} extends Props ? { props?: Props } : { props: Props }),
): () => void {
    const fullscreen = options?.fullscreen ?? true
    const mouseEnabled = options?.mouse ?? true
    const debugEnabled = options?.debug ?? false
    const debugPort = options?.debugPort ?? 9444
    const stylesheet = options?.css ? parseCSS(options.css) : null

    // Render context tracks mutations and determines minimum work
    const ctx = new RenderContext()
    const root = new TermNode('element', 'root')
    root.ctx = ctx

    // Color scheme detection — updated by polling
    let detectedScheme: 'dark' | 'light' = 'dark'

    // Wire schedule callback (defined below, hoisted via closure)
    ctx.onScheduleRender = () => scheduleRender()

    // Persisted render state
    let prevBuffer: CellBuffer | null = null
    let lastStyles: Map<number, ResolvedStyle> | undefined
    let lastFilteredStylesheet: import('./css/parser.js').CSSStyleSheet | null = null
    let lastLayout: Map<number, LayoutBox> | undefined
    let renderScheduled = false
    let initialRegistrationDone = false

    const scheduleRender = () => {
        if (renderScheduled) return
        renderScheduled = true
        queueMicrotask(() => {
            renderScheduled = false
            processQueue()
        })
    }


    const processQueue = () => {
        const snap = ctx.queue.snapshot()

        if (snap.fullRecompute || !lastStyles || !lastLayout) {
            // Full recompute — initial render, resize, or CSS reload
            fullRender()
        } else if (snap.paintOnly.size > 0 || snap.styleResolve.size > 0
            || snap.layoutSubtree.size > 0 || snap.layoutBubble.size > 0) {
            // Incremental render
            incrementalRender(snap)
        }
    }

    const fullRender = () => {
        const size = getTerminalSize()
        // Set root dimensions so children can use percentage width/height
        root.attributes.set('data-width', String(size.width))
        root.attributes.set('data-height', String(size.height))
        const buffer = new CellBuffer(size.width, size.height)
        const media = { colorScheme: detectedScheme, displayMode: 'terminal' as const, width: size.width, height: size.height }
        lastFilteredStylesheet = stylesheet ? filterByMedia(stylesheet, media) : null
        lastStyles = lastFilteredStylesheet ? resolveStyles(root, lastFilteredStylesheet) : undefined
        // Ensure root style has terminal dimensions for percentage resolution
        if (lastStyles) {
            const rootStyle = lastStyles.get(root.id)
            if (rootStyle) {
                rootStyle.width = size.width
                rootStyle.height = size.height
            }
        }
        lastLayout = lastStyles ? computeLayout(root, lastStyles, size.width, size.height) : undefined
        if (lastLayout) syncLayoutCache(root, lastLayout)
        paint(root, buffer, lastStyles, lastLayout)
        const output = diffBuffers(prevBuffer, buffer)
        if (output.length > 0) writeOutput(output)
        prevBuffer = buffer

        // Register focusable elements and mutation callbacks after initial render
        if (!initialRegistrationDone) {
            registerFocusableNodes(root, focusManager)
            registerMutationCallbacks(root, ctx, scheduleRender)
            initialRegistrationDone = true
        }
    }

    const incrementalRender = (snap: RenderQueueSnapshot) => {
        const size = getTerminalSize()

        // Mutable copies for promoted nodes during processing
        const layoutSubtree = new Set(snap.layoutSubtree)
        const layoutBubble = new Set(snap.layoutBubble)

        // Step 1: Incremental style resolution
        if (snap.styleResolve.size > 0 && lastStyles && lastFilteredStylesheet) {
            lastStyles = resolveStylesIncremental(
                root, lastFilteredStylesheet, lastStyles, snap.styleResolve,
                undefined,
                (node) => { layoutSubtree.add(node) },
            )
        }

        // Step 2: Incremental layout
        if (layoutSubtree.size > 0 || layoutBubble.size > 0) {
            const dirtyLayoutNodes = new Set([...layoutSubtree, ...layoutBubble])
            if (lastStyles && lastLayout) {
                lastLayout = computeLayoutIncremental(
                    root, lastStyles, lastLayout, dirtyLayoutNodes, size.width, size.height,
                )
            } else {
                lastLayout = lastStyles ? computeLayout(root, lastStyles, size.width, size.height) : undefined
            }
            if (lastLayout) syncLayoutCache(root, lastLayout)
        }

        // Step 3: Repaint
        const noLayoutChanges = layoutSubtree.size === 0 && layoutBubble.size === 0
        const dirtyPaintNodes = new Set(snap.paintOnly)
        // Style-resolved nodes that didn't affect layout still need repaint
        if (noLayoutChanges) {
            for (const node of snap.styleResolve) dirtyPaintNodes.add(node)
        }

        const hasScroll = hasScrolledNode(root)
        if (noLayoutChanges && !hasScroll && dirtyPaintNodes.size > 0 && prevBuffer && lastStyles && lastLayout) {
            const buffer = prevBuffer.clone()
            paintNodes(dirtyPaintNodes, buffer, lastStyles, lastLayout, root)
            const output = diffBuffers(prevBuffer, buffer)
            if (output.length > 0) writeOutput(output)
            prevBuffer = buffer
        } else {
            const buffer = new CellBuffer(size.width, size.height)
            paint(root, buffer, lastStyles, lastLayout)
            const output = diffBuffers(prevBuffer, buffer)
            if (output.length > 0) writeOutput(output)
            prevBuffer = buffer
        }
    }

    const focusManager = new FocusManager()
    focusManager.onSetAttribute = (node, key, value) => ctx.onSetAttribute(node, key, value)
    focusManager.onRemoveAttribute = (node, key) => ctx.onRemoveAttribute(node, key)
    focusManager.onFocusChange = (focused, previous) => {
        if (previous) dispatchEvent(previous, 'blur')
        if (focused) {
            dispatchEvent(focused, 'focus')
            scrollIntoView(focused, lastLayout, lastStyles, ctx)
        }
    }

    // Schedule render on mutations
    const origInsert = ctx.onInsert.bind(ctx)
    ctx.onInsert = (parent: TermNode, child: TermNode) => {
        origInsert(parent, child)
        // Register focusable/mutation callbacks on newly inserted nodes
        if (initialRegistrationDone) {
            registerFocusableNodes(child, focusManager)
            registerMutationCallbacks(child, ctx, scheduleRender)
        }
        scheduleRender()
    }

    // Schedule render for other mutations
    const origSetText = ctx.onSetText.bind(ctx)
    ctx.onSetText = (node: TermNode, text: string) => {
        origSetText(node, text)
        scheduleRender()
    }

    const origSetAttr = ctx.onSetAttribute.bind(ctx)
    ctx.onSetAttribute = (node: TermNode, key: string, value: string) => {
        origSetAttr(node, key, value)
        scheduleRender()
    }

    const origRemoveAttr = ctx.onRemoveAttribute.bind(ctx)
    ctx.onRemoveAttribute = (node: TermNode, key: string) => {
        origRemoveAttr(node, key)
        scheduleRender()
    }

    const origRemove = ctx.onRemove.bind(ctx)
    ctx.onRemove = (child: TermNode, parent: TermNode) => {
        origRemove(child, parent)
        unregisterFocusableNodes(child, focusManager)
        child.cleanup()
        scheduleRender()
    }

    enableRawMode()
    if (fullscreen) enterFullscreen()
    // Write mode sequences directly — sync update wrapping can interfere
    process.stdout.write(ansi.enableBracketedPaste())
    if (mouseEnabled) process.stdout.write(ansi.enableMouse())

    // Single stdin router — all input flows through here
    const router = new StdinRouter()

    const handleKeyData = (data: Buffer) => {
        const key = parseKeyEvent(data)
        if (!key) return

        if (key.ctrl && key.key === 'c') { doCleanup(); process.exit(0) }
        if (key.ctrl && key.key === 'z') { doCleanup(); process.kill(process.pid, 'SIGTSTP'); return }

        if (key.key === 'Tab' && key.shift) { focusManager.focusPrevious(); scheduleRender(); return }
        if (key.key === 'Tab') { focusManager.focusNext(); scheduleRender(); return }
        if (key.key === 'Enter' && focusManager.focused) {
            const target = focusManager.focused
            const event = dispatchEvent(target, 'click')
            // Default action: open links in browser (unless preventDefault was called)
            if (!event.defaultPrevented && target.tag === 'a') {
                const href = target.attributes.get('href')
                if (href) openUrl(href)
            }
            scheduleRender()
            return
        }

        // Text input for focused input/textarea
        const focused = focusManager.focused
        if (focused && (focused.tag === 'input' || focused.tag === 'textarea')) {
            if (!focused.textBuffer) focused.textBuffer = new TextBuffer(focused.attributes.get('value') ?? '')
            if (focused.textBuffer.handleKey(key)) {
                const newValue = focused.textBuffer.text
                focused.attributes.set('value', newValue)
                const textChild = focused.children.find(c => c.nodeType === 'text')
                if (textChild) ctx.onSetText(textChild, newValue)
                // Enqueue the input element itself for repaint (cursor may have moved)
                ctx.queue.enqueuePaintOnly(focused)
                dispatchEvent(focused, 'input', { value: newValue, cursor: focused.textBuffer.cursor })
                scheduleRender()
                return
            }
        }

        const keyTarget = focused ?? findFirstElement(root)
        if (keyTarget) { dispatchEvent(keyTarget, 'keydown', key); scheduleRender() }
    }

    const handleMouseData = (data: Buffer) => {
        const mouse = parseMouseEvent(data)
        if (!mouse) return
        handleMouse(mouse, root, lastLayout, focusManager, scheduleRender, lastStyles, ctx)
    }

    const handlePaste = (text: string) => {
        const focused = focusManager.focused
        if (focused && (focused.tag === 'input' || focused.tag === 'textarea')) {
            if (!focused.textBuffer) focused.textBuffer = new TextBuffer(focused.attributes.get('value') ?? '')
            focused.textBuffer.insert(text)
            const newValue = focused.textBuffer.text
            focused.attributes.set('value', newValue)
            const textChild = focused.children.find(c => c.nodeType === 'text')
            if (textChild) ctx.onSetText(textChild, newValue)
            dispatchEvent(focused, 'input', { value: newValue, cursor: focused.textBuffer.cursor })
            scheduleRender()
        } else {
            const target = focused ?? findFirstElement(root)
            if (target) dispatchEvent(target, 'paste', { text })
        }
    }

    router.start({ onKey: handleKeyData, onMouse: handleMouseData, onPaste: handlePaste })

    // Debug server (opt-in)
    let debugServer: DebugServer | null = null
    let consoleDomain: ConsoleDomain | null = null
    if (debugEnabled) {
        debugServer = new DebugServer(debugPort)
        consoleDomain = new ConsoleDomain(debugServer)
        debugServer.registerDomain('Console', consoleDomain)
        consoleDomain.start()
        debugServer.start()
    }

    // Serialised color scheme detection via router query
    const detectScheme = async (): Promise<'dark' | 'light'> => {
        const result = await router.query('\x1b]11;?\x07', matchOSC11, 200)
        return result ? parseOSC11Scheme(result) : 'dark'
    }

    // Detect scheme, then mount and render
    let doCleanup = () => {}

    detectScheme().then((scheme) => {
        detectedScheme = scheme

        ctx.queue.setFullRecompute()
        const { unmount: svUnmount } = renderer.render(
            AppComponent as any,
            { target: root, props: (options as any)?.props ?? {} },
        )
        scheduleRender()

        setupResizeHandler(() => { ctx.onResize(); prevBuffer = null; scheduleRender() })

        // Poll color scheme every second via serialised queries
        let pollRunning = true
        const pollScheme = async () => {
            if (!pollRunning) return
            const scheme = await detectScheme()
            if (scheme !== detectedScheme) {
                detectedScheme = scheme
                lastFilteredStylesheet = stylesheet ? filterByMedia(stylesheet,
                    { colorScheme: detectedScheme, displayMode: 'terminal', width: getTerminalSize().width, height: getTerminalSize().height }) : null
                ctx.onResize()
                prevBuffer = null
                scheduleRender()
            }
            if (pollRunning) setTimeout(pollScheme, 1000)
        }
        setTimeout(pollScheme, 1000)

        const appCleanup = createCleanup(svUnmount, fullscreen, mouseEnabled)
        doCleanup = () => {
            pollRunning = false
            router.stop()
            consoleDomain?.stop()
            debugServer?.stop()
            appCleanup()
        }
    })

    process.on('SIGINT', () => { doCleanup(); process.exit(0) })
    process.on('SIGTERM', () => { doCleanup(); process.exit(0) })

    return () => doCleanup()
}

function createCleanup(unmountComponent: () => void, fullscreen: boolean, mouseEnabled: boolean): () => void {
    let cleaned = false
    return () => {
        if (cleaned) return
        cleaned = true
        unmountComponent()
        if (mouseEnabled) writeOutput(ansi.disableMouse())
        writeOutput(ansi.disableBracketedPaste())
        if (fullscreen) exitFullscreen()
        disableRawMode()
    }
}


function handleMouse(
    mouse: MouseEvent,
    root: TermNode,
    layout: Map<number, LayoutBox> | undefined,
    focusManager: FocusManager,
    scheduleRender: () => void,
    lastStyles: Map<number, ResolvedStyle> | undefined,
    ctx: RenderContext,
): void {
    if (!layout) return

    // Handle hover — set data-hovered on element under cursor
    if (mouse.type === 'motion') {
        const target = hitTest(root, layout, mouse.col, mouse.row)
        const hoveredId = target?.id ?? -1
        // Walk tree and update data-hovered
        updateHover(root, hoveredId, ctx)
        scheduleRender()
        return
    }

    if (mouse.type !== 'press' && mouse.type !== 'scroll') return

    if (mouse.button === 'left') {
        const target = hitTest(root, layout, mouse.col, mouse.row)
        if (target) {
            // Focus clicked element if it's focusable
            if (FOCUSABLE_TAGS.has(target.tag ?? '')) {
                focusManager.focusByNode(target)
            }
            const event = dispatchEvent(target, 'click', mouse)
            if (!event.defaultPrevented && target.tag === 'a') {
                const href = target.attributes.get('href')
                if (href) openUrl(href)
            }
            scheduleRender()
        }
    } else if (mouse.button === 'scrollUp' || mouse.button === 'scrollDown') {
        const target = hitTest(root, layout, mouse.col, mouse.row)
        if (target) {
            const scrollTarget = findScrollableAncestor(target, lastStyles)
            if (scrollTarget) {
                const box = layout.get(scrollTarget.id)
                if (box) {
                    const contentHeight = scrollTarget.children.reduce((sum, c) => {
                        const cBox = layout.get(c.id)
                        return cBox ? Math.max(sum, cBox.y - box.y + cBox.height) : sum
                    }, 0)
                    const delta = mouse.button === 'scrollUp' ? -3 : 3
                    const maxScroll = Math.max(0, contentHeight - box.height)
                    scrollTarget.scrollTop = Math.max(0, Math.min(scrollTarget.scrollTop + delta, maxScroll))
                    ctx.onScroll(scrollTarget)
                }
            }
            dispatchEvent(target, 'scroll', mouse)
            scheduleRender()
        }
    }
}

function setupResizeHandler(onResize: () => void): void {
    process.stdout.on('resize', onResize)
}

function registerMutationCallbacks(node: TermNode, ctx: RenderContext, scheduleRender: () => void): void {
    if (node.nodeType === 'text') {
        node.onMutate = () => {
            ctx.queue.enqueuePaintOnly(node)
            scheduleRender()
        }
    }
    for (const child of node.children) {
        registerMutationCallbacks(child, ctx, scheduleRender)
    }
}

const FOCUSABLE_TAGS = new Set(['button', 'input', 'textarea', 'a', 'select'])

function registerFocusableNodes(node: TermNode, focusManager: FocusManager): void {
    if (node.nodeType === 'element' && FOCUSABLE_TAGS.has(node.tag ?? '')) {
        focusManager.register(node)
    }
    for (const child of node.children) {
        registerFocusableNodes(child, focusManager)
    }
}

function unregisterFocusableNodes(node: TermNode, focusManager: FocusManager): void {
    if (node.nodeType === 'element' && FOCUSABLE_TAGS.has(node.tag ?? '')) {
        focusManager.unregister(node)
    }
    for (const child of node.children) {
        unregisterFocusableNodes(child, focusManager)
    }
}

function updateHover(node: TermNode, hoveredId: number, ctx: RenderContext): void {
    if (node.nodeType !== 'element') return
    const isHovered = node.id === hoveredId
    const wasHovered = node.attributes.has('data-hovered')
    if (isHovered && !wasHovered) {
        ctx.onSetAttribute(node, 'data-hovered', 'true')
    } else if (!isHovered && wasHovered) {
        ctx.onRemoveAttribute(node, 'data-hovered')
    }
    for (const child of node.children) {
        updateHover(child, hoveredId, ctx)
    }
}

function findScrollableAncestor(node: TermNode, styles?: Map<number, ResolvedStyle>): TermNode | null {
    let current: TermNode | null = node
    while (current) {
        const style = styles?.get(current.id)
        if (style && (style.overflow === 'scroll' || style.overflow === 'auto' || style.overflow === 'hidden')) {
            return current
        }
        current = current.parent
    }
    return null
}

function scrollIntoView(
    node: TermNode,
    layout: Map<number, LayoutBox> | undefined,
    styles: Map<number, ResolvedStyle> | undefined,
    ctx: RenderContext,
): void {
    if (!layout) return
    const nodeBox = layout.get(node.id)
    if (!nodeBox) return

    const scroller = findScrollableAncestor(node, styles)
    if (!scroller) return

    const scrollerBox = layout.get(scroller.id)
    if (!scrollerBox) return

    const borderInset = (styles?.get(scroller.id)?.borderStyle !== 'none' &&
        styles?.get(scroller.id)?.borderStyle !== undefined) ? 1 : 0
    const viewTop = scrollerBox.y + borderInset + scroller.scrollTop
    const viewBottom = viewTop + scrollerBox.height - borderInset * 2

    // Node position relative to scroller content
    if (nodeBox.y < viewTop) {
        scroller.scrollTop = nodeBox.y - scrollerBox.y - borderInset
        ctx.onScroll(scroller)
    } else if (nodeBox.y + nodeBox.height > viewBottom) {
        scroller.scrollTop = nodeBox.y + nodeBox.height - scrollerBox.y - scrollerBox.height + borderInset
        ctx.onScroll(scroller)
    }
}

function openUrl(url: string): void {
    const { exec } = require('child_process') as typeof import('child_process')
    const cmd = process.platform === 'darwin' ? 'open'
        : process.platform === 'win32' ? 'start'
        : 'xdg-open'
    exec(`${cmd} ${JSON.stringify(url)}`)
}

function hasScrolledNode(node: TermNode): boolean {
    if (node.scrollTop !== 0 || node.scrollLeft !== 0) return true
    for (const child of node.children) {
        if (hasScrolledNode(child)) return true
    }
    return false
}

function findFirstElement(node: TermNode): TermNode | null {
    for (const child of node.children) {
        if (child.nodeType === 'element') return child
    }
    return node
}

export { TermNode } from './renderer/node.js'
export { CellBuffer } from './render/buffer.js'
export { parseCSS } from './css/parser.js'
export { resolveStyles } from './css/compute.js'
export { StdinRouter } from './terminal/stdin-router.js'
