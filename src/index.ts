import { mount, unmount } from 'svelte/renderer'
import type { Component, ComponentType, SvelteComponent } from 'svelte'
import { TermNode } from './renderer/index.js'
import { hasBooleanAttribute } from './renderer/node.js'
import { AnimationClock } from './render/animation-clock.js'
import { getKeyframes } from './css/animation.js'
import renderer from './renderer/default.js'
import { CellBuffer } from './render/buffer.js'
import { diffBuffers } from './render/diff.js'
import { paint } from './render/paint.js'
import { parseCSS } from './css/parser.js'
import { DEFAULT_STYLESHEET } from './css/defaults.js'
import { resolveStyles, filterByMedia, type ResolvedStyle } from './css/compute.js'
import { collectVariables } from './css/variables.js'
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
import { isCheckableInput, toggleCheckable } from './input/checkable.js'
import { toggleDetails } from './input/details.js'
import { cycleSelect } from './input/select.js'
import { labelledControl } from './input/label.js'
import { TextBuffer } from './components/text-buffer.js'
import { syncEditConstraints } from './input/edit-constraints.js'
import { caretOffsetForClick, ClickCounter } from './input/field-caret.js'
import { StdinRouter, matchOSC11, parseOSC11Scheme } from './terminal/stdin-router.js'
import { detectCapabilities, matchCPR, parseCPRRow, type ColorDepth } from './terminal/capabilities.js'
import { copyToClipboard } from './terminal/clipboard.js'
import { SelectionController, applySelectionOverlay } from './input/selection.js'
import { InlineScreen } from './render/inline.js'
import { GraphicsLayer } from './render/graphics-layer.js'
import { registerInlineHooks } from './framelog.js'
import { activeModal, withinSubtree } from './input/modal.js'
import type { CSSStyleSheet } from './css/parser.js'
import * as ansi from './render/ansi.js'
import { emitFocusCursor } from './render/cursor-emit.js'
import { enterFullscreen, exitFullscreen } from './terminal/screen.js'
import { type TerminalIO, ProcessIO } from './terminal/io.js'

export interface ConsoleEntry {
    level: 'log' | 'warn' | 'error' | 'info' | 'debug'
    args: string[]
    timestamp: number
}

export interface RunOptions {
    fullscreen?: boolean
    css?: string
    mouse?: boolean
    debug?: boolean
    debugPort?: number
    io?: TerminalIO
    onConsole?: (entry: ConsoleEntry) => void
    /**
     * Override the terminal's color scheme. When set, OSC11 polling is
     * skipped and this value is used directly. Useful for embedded
     * terminals (browser previews) where the OSC channel is meaningless
     * and the host already knows the scheme.
     */
    colorScheme?: 'dark' | 'light'
    /**
     * 'fullscreen' (default) uses the alternate screen buffer. 'inline'
     * renders at the shell cursor in the main buffer: output above the
     * live area scrolls into real scrollback, the live area sizes to its
     * content, and all cursor movement is relative. Mouse events map
     * into the live area via a cursor-position query; clicks on shell
     * history above it are ignored.
     */
    mode?: 'fullscreen' | 'inline'
    /**
     * Key combinations that exit the app. Ctrl+C always exits; add
     * 'ctrl+d' for EOF-style exit. Default: ['ctrl+c'].
     */
    exitOn?: Array<'ctrl+c' | 'ctrl+d'>
    /**
     * Override colour depth instead of detecting it (NO_COLOR/COLORTERM/
     * XTVERSION). Hex colours quantize to the terminal's palette at emit
     * time; `mono` drops colour output entirely.
     */
    colorDepth?: ColorDepth
}

/** @deprecated Use RunOptions */
export type MountOptions = RunOptions

export interface RunHandle {
    /** Tear down the run — restore stdio, unmount components, stop pollers. */
    cleanup: () => void
    /**
     * Update the active color scheme on a live run. Triggers a full repaint
     * so default-colored cells render with the new defaults and CSS @media
     * (color-scheme: ...) rules re-resolve. No-op if the scheme is unchanged.
     *
     * Calling this also stops any background OSC-11 polling — the caller is
     * declaring they own the scheme, and we don't want the poller racing to
     * overwrite it 1s later.
     */
    setColorScheme: (scheme: 'dark' | 'light') => void
}

/** Deduped so HMR re-evaluation doesn't accumulate copies. */
const registeredComponentCss = new Set<string>()

/**
 * Register a component's extracted CSS before run() is called. Bundled
 * builds (`svelterm build`) and the dev-mode transform append a
 * registration call to each compiled component so it carries its styles;
 * run() falls back to the registry when no `css` option is given.
 */
export function registerComponentCss(css: string): void {
    if (css) registeredComponentCss.add(css)
}

export function run<Props extends Record<string, any>>(
    AppComponent: ComponentType<SvelteComponent<Props>> | Component<Props>,
    options?: RunOptions & ({} extends Props ? { props?: Props } : { props: Props }),
): RunHandle {
    const io = options?.io ?? new ProcessIO()
    // `fullscreen: false` without an explicit mode gets the inline
    // renderer (what a main-buffer app actually needs). An explicit
    // `mode` always wins — `mode: 'fullscreen', fullscreen: false` is
    // full-viewport rendering without the alternate screen (embedded
    // previews drive a virtual terminal that way).
    const inline = options?.mode ? options.mode === 'inline' : options?.fullscreen === false
    const fullscreen = !inline && (options?.fullscreen ?? true)
    const mouseEnabled = options?.mouse ?? true
    const debugEnabled = options?.debug ?? false
    const debugPort = options?.debugPort ?? 9444
    const exitOn = options?.exitOn ?? ['ctrl+c']
    const userCss = options?.css ?? [...registeredComponentCss].join('\n')
    let stylesheet = parseCSS(DEFAULT_STYLESHEET + userCss)

    // Console capture — only intercept when our IO owns the JS runtime's
    // stdout/stderr (ProcessIO). With InProcessIO (browser, tests) console
    // writes don't corrupt anything, so leave them alone. When intercepting,
    // route to onConsole if provided; otherwise throw — silent suppression
    // hides log calls and lengthens the feedback loop.
    const onConsole = options?.onConsole
    const ownsStdio = io instanceof ProcessIO
    const levels = ['log', 'warn', 'error', 'info', 'debug'] as const
    let restoreConsole = () => {}
    if (ownsStdio) {
        const originals = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            info: console.info.bind(console),
            debug: console.debug.bind(console),
        }
        for (const level of levels) {
            ;(console as any)[level] = (...args: any[]) => {
                if (onConsole) {
                    onConsole({
                        level,
                        args: args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2) ?? String(a)),
                        timestamp: Date.now(),
                    })
                    return
                }
                throw new Error(
                    `console.${level} would corrupt the terminal — pass an onConsole option to run() to route log output, or remove the call`,
                )
            }
        }
        restoreConsole = () => {
            for (const level of levels) {
                (console as any)[level] = originals[level]
            }
        }
    }

    // Render context tracks mutations and determines minimum work
    const ctx = new RenderContext()
    const root = new TermNode('element', 'root')
    root.ctx = ctx

    // Color scheme detection — updated by polling unless the host
    // overrode it via options.colorScheme.
    const colorSchemeOverride = options?.colorScheme
    let detectedScheme: 'dark' | 'light' = colorSchemeOverride ?? 'dark'

    // Wire schedule callback (defined below, hoisted via closure)
    ctx.onScheduleRender = () => scheduleRender()

    // Persisted render state
    /** What the terminal currently shows (selection overlay included). */
    let prevBuffer: CellBuffer | null = null
    /** The last paint without the selection overlay — diff/extraction base. */
    let prevClean: CellBuffer | null = null

    const selection = new SelectionController(() => prevClean)
    const inlineScreen = new InlineScreen()
    if (inline) {
        registerInlineHooks(root, { releaseTop: n => inlineScreen.releaseTop(n) })
    }

    /** Learn where the inline zone starts so mouse coordinates can map. */
    const queryInlineOrigin = () => {
        // The terminal reports where the cursor is, which is wherever the
        // last render left it *within* the zone — snapshot that at the
        // moment the query bytes go out (queries queue behind others).
        let cursorRowAtQuery = 0
        router.query('\x1b[6n', matchCPR, 200,
            () => { cursorRowAtQuery = inlineScreen.cursorZoneRow() },
        ).then(reply => {
            const row = parseCPRRow(reply)
            if (row !== null) inlineScreen.setOriginRow(Math.max(1, row - cursorRowAtQuery))
        }).catch(() => { /* terminal without CPR — mouse stays off-zone */ })
    }

    /** The buffer as displayed: the clean paint plus any selection. */
    const overlayed = (buffer: CellBuffer): CellBuffer => {
        const range = selection.range()
        if (!range) return buffer
        const display = buffer.clone()
        applySelectionOverlay(display, range)
        return display
    }

    /** Re-diff after a selection change without repainting the tree. */
    const redrawSelection = () => {
        if (!prevClean) return
        const display = overlayed(prevClean)
        const output = diffBuffers(prevBuffer, display)
        if (output.length > 0) writeOutput(output)
        prevBuffer = display
    }
    let lastStyles: Map<number, ResolvedStyle> | undefined
    let lastFilteredStylesheet: import('./css/parser.js').CSSStyleSheet | null = null
    let lastLayout: Map<number, LayoutBox> | undefined
    let renderScheduled = false
    let initialRegistrationDone = false

    // CSS animations — reapply the current keyframe and repaint while live
    const animationClock = new AnimationClock()
    animationClock.onFrame = () => {
        if (!lastStyles) return
        const dirty = animationClock.apply(lastStyles)
        if (dirty.length === 0) return
        for (const { node, touchesLayout } of dirty) {
            if (touchesLayout) ctx.queue.enqueueLayoutBubble(node)
            else ctx.queue.enqueuePaintOnly(node)
        }
        scheduleRender()
    }

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
        const dirty = snap.paintOnly.size > 0 || snap.styleResolve.size > 0
            || snap.layoutSubtree.size > 0 || snap.layoutBubble.size > 0

        if (inline) {
            // The live area is content-sized, so any change can move
            // everything — always render fully.
            if (snap.fullRecompute || dirty || !lastStyles) fullRender()
        } else if (snap.fullRecompute || !lastStyles || !lastLayout) {
            // Full recompute — initial render, resize, or CSS reload
            fullRender()
        } else if (dirty) {
            // Incremental render
            incrementalRender(snap)
        }
    }

    // Synchronized output (DEC 2026) is on until detection says otherwise —
    // terminals that don't know the mode ignore it.
    let syncOutput = true
    const writeOutput = (data: string) => {
        io.write(syncOutput ? ansi.beginSyncUpdate() + data + ansi.endSyncUpdate() : data)
    }

    // Kitty-graphics layer — off until capability detection turns it on.
    const graphicsLayer = new GraphicsLayer()
    let graphicsEnabled = false
    /** The per-frame tail written after the cell diff: cursor + images. */
    const frameTail = (): string => {
        const cursor = emitFocusCursor(root, focusManager.focused)
        return graphicsEnabled ? cursor + graphicsLayer.render(root, lastLayout) : cursor
    }

    /** Resolve styles + layout for the current terminal size. */
    const resolveForRender = (size: { width: number; height: number }) => {
        root.attributes.set('data-width', String(size.width))
        root.attributes.set('data-height', String(size.height))
        const media = { colorScheme: detectedScheme, displayMode: 'terminal' as const, width: size.width, height: size.height }
        lastFilteredStylesheet = stylesheet ? filterByMedia(stylesheet, media) : null
        // Passing `media` here threads colorScheme into computeStyle so
        // light-dark() resolves against the active scheme.
        lastStyles = lastFilteredStylesheet ? resolveStyles(root, lastFilteredStylesheet, media) : undefined
        // Ensure root style has terminal dimensions for percentage resolution
        if (lastStyles) {
            const rootStyle = lastStyles.get(root.id)
            if (rootStyle) {
                rootStyle.width = size.width
                rootStyle.height = size.height
            }
        }
        if (lastStyles && lastFilteredStylesheet) {
            animationClock.sync(root, lastStyles, getKeyframes(lastFilteredStylesheet), {
                variables: collectVariables(root, lastFilteredStylesheet),
                scheme: detectedScheme,
            })
            animationClock.syncTransitions(root, lastStyles)
            animationClock.apply(lastStyles)
        }
        lastLayout = lastStyles ? computeLayout(root, lastStyles, size.width, size.height) : undefined
        if (lastLayout) {
            syncLayoutCache(root, lastLayout)
            clampScrollPositions(root, lastLayout, io)
        }
    }

    const fullRender = () => {
        if (inline) { inlineRender(); return }
        const size = io.getSize()
        const buffer = new CellBuffer(size.width, size.height)
        resolveForRender(size)
        paint(root, buffer, lastStyles, lastLayout)
        prevClean = buffer
        const display = overlayed(buffer)
        const output = diffBuffers(prevBuffer, display) + frameTail()
        if (output.length > 0) writeOutput(output)
        prevBuffer = display

        // Register focusable elements after initial render
        if (!initialRegistrationDone) {
            registerFocusableNodes(root, focusManager)
            initialRegistrationDone = true
        }
    }

    /**
     * Inline mode always renders fully: the live area is content-sized
     * (clamped to the terminal height — archive to keep it short) and the
     * InlineScreen driver emits relative-movement diffs.
     */
    const inlineRender = () => {
        const size = io.getSize()
        resolveForRender(size)
        const rootBox = lastLayout?.get(root.id)
        const extent = lastLayout && rootBox
            ? contentExtent(root, lastLayout, rootBox)
            : { width: size.width, height: 1 }
        const height = Math.max(1, Math.min(extent.height, size.height))
        const buffer = new CellBuffer(size.width, height)
        paint(root, buffer, lastStyles, lastLayout)
        prevClean = buffer

        let output = inlineScreen.render(buffer)
        const pos = focusManager.focused?.getCursorScreenPos()
        if (pos && pos.inViewport && pos.y < height) {
            output += inlineScreen.moveCursorTo(pos.x, pos.y)
                + ansi.setCursorShape('bar') + ansi.showCursor()
        } else {
            output += ansi.hideCursor() + ansi.resetCursorShape()
        }
        if (graphicsEnabled) output += graphicsLayer.render(root, lastLayout)
        if (output.length > 0) writeOutput(output)

        if (!initialRegistrationDone) {
            registerFocusableNodes(root, focusManager)
            initialRegistrationDone = true
        }
    }

    const incrementalRender = (snap: RenderQueueSnapshot) => {
        const size = io.getSize()

        // Mutable copies for promoted nodes during processing
        const layoutSubtree = new Set(snap.layoutSubtree)
        const layoutBubble = new Set(snap.layoutBubble)

        // Step 1: Incremental style resolution
        if (snap.styleResolve.size > 0 && lastStyles && lastFilteredStylesheet) {
            const resolvedIds = new Set<number>()
            lastStyles = resolveStylesIncremental(
                root, lastFilteredStylesheet, lastStyles, snap.styleResolve,
                (nodeId) => { resolvedIds.add(nodeId) },
                (node) => { layoutSubtree.add(node) },
                detectedScheme,
            )
            // Newly mounted or restyled nodes may start/stop animations,
            // and re-resolution resets styles to their base keyframe.
            animationClock.sync(root, lastStyles, getKeyframes(lastFilteredStylesheet), {
                variables: collectVariables(root, lastFilteredStylesheet),
                scheme: detectedScheme,
            })
            animationClock.syncTransitions(root, lastStyles, resolvedIds)
            animationClock.apply(lastStyles)
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
        if (noLayoutChanges && !hasScroll && dirtyPaintNodes.size > 0 && prevClean && lastStyles && lastLayout) {
            const buffer = prevClean.clone()
            paintNodes(dirtyPaintNodes, buffer, lastStyles, lastLayout, root)
            prevClean = buffer
            const display = overlayed(buffer)
            const output = diffBuffers(prevBuffer, display) + frameTail()
            if (output.length > 0) writeOutput(output)
            prevBuffer = display
        } else {
            const buffer = new CellBuffer(size.width, size.height)
            paint(root, buffer, lastStyles, lastLayout)
            prevClean = buffer
            const display = overlayed(buffer)
            const output = diffBuffers(prevBuffer, display) + frameTail()
            if (output.length > 0) writeOutput(output)
            prevBuffer = display
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

    // Register focusable nodes on insert, unregister on remove
    const origInsert = ctx.onInsert.bind(ctx)
    ctx.onInsert = (parent: TermNode, child: TermNode) => {
        origInsert(parent, child)
        if (initialRegistrationDone) {
            registerFocusableNodes(child, focusManager)
        }
    }

    const origRemove = ctx.onRemove.bind(ctx)
    ctx.onRemove = (child: TermNode, parent: TermNode) => {
        origRemove(child, parent)
        unregisterFocusableNodes(child, focusManager)
        child.cleanup()
    }

    io.enableRawMode()
    if (fullscreen) enterFullscreen(io)
    // Cursor visibility is owned at the run-lifecycle level, not by
    // enterFullscreen — non-fullscreen runs need it hidden too. The
    // post-paint emitter takes over from here, showing the cursor only
    // when something asks for it (focused input, region cursor).
    io.write(ansi.hideCursor())
    // Write mode sequences directly — sync update wrapping can interfere
    io.write(ansi.enableBracketedPaste())
    // Kitty keyboard protocol: unsupported terminals ignore the push/pop
    io.write(ansi.pushKittyKeyboard())
    if (mouseEnabled) io.write(ansi.enableMouse())

    // Single stdin router — all input flows through here
    const router = new StdinRouter(io)

    const handleKeyData = (data: Buffer | Uint8Array) => {
        const key = parseKeyEvent(data)
        if (!key) return

        if (key.ctrl && key.key === 'c') { doCleanup(); if (typeof process !== 'undefined') process.exit(0); return }
        if (key.ctrl && key.key === 'd' && exitOn.includes('ctrl+d')) {
            doCleanup(); if (typeof process !== 'undefined') process.exit(0); return
        }
        if (key.ctrl && key.key === 'z') { suspend(); return }

        // An open <dialog> captures keys: Escape closes it, Tab traps inside
        const modal = activeModal(root)
        focusManager.setScope(modal)
        if (modal && key.key === 'Escape') {
            modal.attributes.delete('open')
            ctx.onRemoveAttribute(modal, 'open')
            dispatchEvent(modal, 'close')
            focusManager.setScope(null)
            scheduleRender()
            return
        }
        if (modal && focusManager.focused && !withinSubtree(focusManager.focused, modal)) {
            focusManager.focusNext() // pull focus into the modal
        }

        if (key.key === 'Tab' && key.shift) { focusManager.focusPrevious(); scheduleRender(); return }
        if (key.key === 'Tab') { focusManager.focusNext(); scheduleRender(); return }
        if (key.key === 'Enter' && focusManager.focused) {
            const target = focusManager.focused
            if (hasBooleanAttribute(target, 'disabled')) return
            const event = dispatchEvent(target, 'click')
            // Default action: open links in browser (unless preventDefault was called)
            if (!event.defaultPrevented && target.tag === 'a') {
                const href = target.attributes.get('href')
                if (href) openUrl(href)
            }
            if (!event.defaultPrevented && target.tag === 'summary') toggleDetails(target)
            if (!event.defaultPrevented && target.tag === 'select') cycleSelect(target, 1)
            scheduleRender()
            return
        }

        // Space toggles a focused checkbox or selects a focused radio
        if (key.key === ' ' && focusManager.focused && isCheckableInput(focusManager.focused)) {
            toggleCheckable(focusManager.focused)
            scheduleRender()
            return
        }

        // A focused select cycles its options (popup-less interaction)
        if (focusManager.focused?.tag === 'select') {
            if (key.key === 'ArrowUp') { cycleSelect(focusManager.focused, -1); scheduleRender(); return }
            if (key.key === 'ArrowDown' || key.key === ' ') { cycleSelect(focusManager.focused, 1); scheduleRender(); return }
        }

        // Text input for focused input/textarea
        const focused = focusManager.focused
        if (focused && (focused.tag === 'input' || focused.tag === 'textarea') && !isCheckableInput(focused)) {
            if (!focused.textBuffer) focused.textBuffer = new TextBuffer(focused.attributes.get('value') ?? '')
            syncEditConstraints(focused)
            const oldValue = focused.textBuffer.text
            if (focused.textBuffer.handleKey(key)) {
                const copied = focused.textBuffer.drainClipboardText()
                if (copied) copyToClipboard(copied, data => io.write(data))
                const newValue = focused.textBuffer.text
                focused.attributes.set('value', newValue)
                const textChild = focused.children.find(c => c.nodeType === 'text')
                if (textChild) ctx.onSetText(textChild, newValue)
                // Enqueue the input element itself for repaint (cursor may have moved)
                ctx.queue.enqueuePaintOnly(focused)
                // input fires on value change, not caret movement (per spec)
                if (newValue !== oldValue) {
                    dispatchEvent(focused, 'input', { value: newValue, cursor: focused.textBuffer.cursor })
                }
                scheduleRender()
                return
            }
        }

        const keyTarget = focused ?? findFirstElement(root)
        if (keyTarget) { dispatchEvent(keyTarget, 'keydown', key); scheduleRender() }
    }

    const handleMouseData = (data: Buffer | Uint8Array) => {
        let mouse = parseMouseEvent(data)
        if (!mouse) return
        if (inline) {
            // Mouse rows are screen-absolute; the zone origin comes from a
            // CPR query. Events above the zone (shell history) are ignored.
            const zoneRow = inlineScreen.screenRowToZone(mouse.row, io.getSize().height)
            if (zoneRow === null) return
            mouse = { ...mouse, row: zoneRow }
        }
        handleMouse(mouse, root, lastLayout, focusManager, scheduleRender, lastStyles, ctx, io,
            selection, redrawSelection)
    }

    const handlePaste = (text: string) => {
        const focused = focusManager.focused
        if (focused && (focused.tag === 'input' || focused.tag === 'textarea')) {
            if (!focused.textBuffer) focused.textBuffer = new TextBuffer(focused.attributes.get('value') ?? '')
            syncEditConstraints(focused)
            const oldValue = focused.textBuffer.text
            focused.textBuffer.insert(text)
            const newValue = focused.textBuffer.text
            focused.attributes.set('value', newValue)
            const textChild = focused.children.find(c => c.nodeType === 'text')
            if (textChild) ctx.onSetText(textChild, newValue)
            if (newValue !== oldValue) {
                dispatchEvent(focused, 'input', { value: newValue, cursor: focused.textBuffer.cursor })
            }
            scheduleRender()
        } else {
            const target = focused ?? findFirstElement(root)
            if (target) dispatchEvent(target, 'paste', { text })
        }
    }

    router.start({ onKey: handleKeyData, onMouse: handleMouseData, onPaste: handlePaste })

    // Debug server (opt-in, dynamically imported to avoid ws dependency in browser)
    let debugServer: any = null
    let consoleDomain: any = null
    if (debugEnabled) {
        Promise.all([
            import('./debug/server.js'),
            import('./debug/console.js'),
            import('./debug/dom.js'),
            import('./debug/css.js'),
            import('./debug/input.js'),
        ]).then(([{ DebugServer }, { ConsoleDomain }, { DomDomain }, { CssDomain }, { InputDomain }]) => {
            debugServer = new DebugServer(debugPort)
            consoleDomain = new ConsoleDomain(debugServer)
            const debugCtx = {
                root,
                styles: () => lastStyles,
                layout: () => lastLayout,
                requestRender: () => { ctx.queue.setFullRecompute(); scheduleRender() },
            }
            debugServer.registerDomain('Console', consoleDomain)
            debugServer.registerDomain('DOM', new DomDomain(debugCtx))
            debugServer.registerDomain('CSS', new CssDomain(debugCtx))
            debugServer.registerDomain('Input', new InputDomain({
                key: handleKeyData,
                mouse: handleMouseData,
                paste: handlePaste,
            }))
            consoleDomain.start()
            debugServer.start()
        })
    }

    // Serialised color scheme detection via router query
    const detectScheme = async (): Promise<'dark' | 'light'> => {
        const result = await router.query('\x1b]11;?\x07', matchOSC11, 200)
        return result ? parseOSC11Scheme(result) : 'dark'
    }

    // Render immediately with default scheme. Seed a Svelte context so
    // descendant components can detect they're rendered in the svelterm
    // target (vs plain browser-Svelte) without resorting to globals —
    // important for components like EmbeddedTerminal that branch their
    // render path. Browser-Svelte mounts have no such key, so a
    // `getContext` call there returns undefined and the component
    // defaults to the browser path.
    ctx.queue.setFullRecompute()
    const app = mount(AppComponent as any, {
        renderer,
        target: root,
        props: (options as any)?.props ?? {},
        context: new Map([[Symbol.for('@svelterm/target'), 'terminal']]),
    } as any)
    const svUnmount = () => void unmount(app)

    // Collect CSS from injected <style> elements (css: 'injected' mode).
    // Skipped when the host passed an explicit `css` option.
    if (!userCss) {
        const injectedCss = collectInjectedCss(root)
        if (injectedCss) {
            stylesheet = parseCSS(DEFAULT_STYLESHEET + injectedCss)
        }
    }

    scheduleRender()

    io.onResize(() => {
        ctx.onResize()
        prevBuffer = null
        scheduleRender()
        // Rewrap may have moved the zone — re-learn where it starts
        if (inline && io instanceof ProcessIO) queryInlineOrigin()
    })

    // Detect color scheme in background and re-render if different.
    // Skipped when the host pinned a scheme via options.colorScheme.
    let pollRunning = true
    const pollScheme = async () => {
        if (!pollRunning) return
        try {
            const scheme = await detectScheme()
            if (scheme !== detectedScheme) {
                detectedScheme = scheme
                const size = io.getSize()
                lastFilteredStylesheet = stylesheet ? filterByMedia(stylesheet,
                    { colorScheme: detectedScheme, displayMode: 'terminal', width: size.width, height: size.height }) : null
                ctx.onResize()
                prevBuffer = null
                scheduleRender()
            }
        } catch {
            // Terminal may not support color scheme queries — ignore
        }
        if (pollRunning) setTimeout(pollScheme, 1000)
    }
    if (!colorSchemeOverride) pollScheme()

    // Detect terminal capabilities in the background: colour depth for
    // SGR quantization, DEC 2026 support for frame batching. Only the
    // real terminal answers queries; embedded IO keeps the defaults.
    if (options?.colorDepth) {
        ansi.setColorDepth(options.colorDepth)
    } else if (io instanceof ProcessIO) {
        if (inline) queryInlineOrigin()
        detectCapabilities(router).then(caps => {
            syncOutput = caps.syncOutput
            // Crisp images on kitty-graphics terminals; half-blocks stay
            // in the buffer as the fallback and layout truth.
            if (caps.graphics && !graphicsEnabled) {
                graphicsEnabled = true
                scheduleRender()
            }
            if (caps.colorDepth === ansi.getColorDepth()) return
            ansi.setColorDepth(caps.colorDepth)
            // Full repaint so every cell re-emits at the new depth
            ctx.onResize()
            prevBuffer = null
            scheduleRender()
        }).catch(() => { /* keep defaults */ })
    }

    const doCleanup = () => {
        pollRunning = false
        animationClock.stop()
        router.stop()
        consoleDomain?.stop()
        debugServer?.stop()
        restoreConsole?.()
        if (graphicsEnabled) io.write(graphicsLayer.clear())
        svUnmount()
        if (mouseEnabled) io.write(ansi.disableMouse())
        io.write(ansi.popKittyKeyboard())
        io.write(ansi.disableBracketedPaste())
        if (fullscreen) exitFullscreen(io)
        if (inline) {
            // Leave the rendered output in place; park the prompt below it.
            io.write(inlineScreen.finish() + ansi.resetCursorShape())
        } else {
            // Show cursor *after* exitFullscreen so it targets the main
            // screen, not the alt screen we're leaving behind.
            io.write(ansi.showCursor() + ansi.resetCursorShape())
        }
        io.disableRawMode()
        io.dispose()
    }

    /**
     * Ctrl+Z: release the terminal without unmounting, stop, and pick up
     * where we left off on `fg` — modes re-enter and everything repaints.
     */
    const suspend = () => {
        if (typeof process === 'undefined') return
        if (graphicsEnabled) io.write(graphicsLayer.clear())
        if (mouseEnabled) io.write(ansi.disableMouse())
        io.write(ansi.popKittyKeyboard() + ansi.disableBracketedPaste())
        if (fullscreen) exitFullscreen(io)
        if (inline) inlineScreen.reset()
        io.write(ansi.showCursor() + ansi.resetCursorShape())
        io.disableRawMode()
        process.kill(process.pid, 'SIGTSTP')
    }

    const resume = () => {
        io.enableRawMode()
        if (fullscreen) enterFullscreen(io)
        io.write(ansi.hideCursor() + ansi.enableBracketedPaste() + ansi.pushKittyKeyboard())
        if (mouseEnabled) io.write(ansi.enableMouse())
        ctx.onResize()
        prevBuffer = null
        prevClean = null
        scheduleRender()
        if (inline && io instanceof ProcessIO) queryInlineOrigin()
    }

    if (typeof process !== 'undefined') {
        process.on('SIGINT', () => { doCleanup(); process.exit(0) })
        process.on('SIGTERM', () => { doCleanup(); process.exit(0) })
        process.on('SIGCONT', resume)
    }

    const setColorScheme = (scheme: 'dark' | 'light') => {
        // Host has spoken — silence the OSC-11 poller so it doesn't overwrite
        // this value on its next 1s tick.
        pollRunning = false
        if (scheme === detectedScheme) return
        detectedScheme = scheme
        const size = io.getSize()
        lastFilteredStylesheet = stylesheet ? filterByMedia(stylesheet,
            { colorScheme: detectedScheme, displayMode: 'terminal', width: size.width, height: size.height }) : null
        ctx.onResize()
        prevBuffer = null
        scheduleRender()
    }

    return { cleanup: doCleanup, setColorScheme }
}

const fieldClicks = new ClickCounter()

function isEditableField(node: TermNode): boolean {
    return node.tag === 'input' && !isCheckableInput(node) && !hasBooleanAttribute(node, 'disabled')
}

/** Caret placement and double-click word selection inside an editable input. */
function handleFieldClick(
    target: TermNode, box: LayoutBox, mouse: MouseEvent,
    ctx: RenderContext, io: TerminalIO,
): void {
    if (!target.textBuffer) target.textBuffer = new TextBuffer(target.attributes.get('value') ?? '')
    syncEditConstraints(target)
    const buf = target.textBuffer
    const offset = caretOffsetForClick(target, box, mouse.col)
    const clicks = fieldClicks.click(target.id, mouse.col, mouse.row, Date.now())
    if (clicks === 2) {
        buf.selectWordAt(offset)
        // Copy-on-select, matching the screen-space double-click behaviour
        const word = buf.selectedText()
        if (word) copyToClipboard(word, data => io.write(data))
    } else {
        buf.collapseSelection()
        buf.cursor = offset
    }
    ctx.queue.enqueuePaintOnly(target)
}

const SCROLLBAR_VISIBLE_MS = 600
const SCROLLBAR_FADE_MS = 400
const SCROLLBAR_FADE_FRAMES = 16
const SCROLLBAR_TOTAL_MS = SCROLLBAR_VISIBLE_MS + SCROLLBAR_FADE_MS
let lastHoveredId = -1

function handleMouse(
    mouse: MouseEvent,
    root: TermNode,
    layout: Map<number, LayoutBox> | undefined,
    focusManager: FocusManager,
    scheduleRender: () => void,
    lastStyles: Map<number, ResolvedStyle> | undefined,
    ctx: RenderContext,
    io: TerminalIO,
    selection: SelectionController,
    redrawSelection: () => void,
): void {
    if (!layout) return

    // Handle hover — only update when the hovered element changes.
    // Dragging with the left button extends the text selection.
    if (mouse.type === 'motion') {
        if (mouse.button === 'left' && selection.onMotion(mouse.col, mouse.row)) {
            redrawSelection()
        }
        const target = hitTest(root, layout, mouse.col, mouse.row)
        const hoveredId = target?.id ?? -1
        if (hoveredId !== lastHoveredId) {
            updateHover(root, hoveredId, ctx)
            lastHoveredId = hoveredId
        }
        return
    }

    // Releasing the left button finishes a selection and copies it
    if (mouse.type === 'release' && mouse.button === 'left') {
        const text = selection.onRelease()
        if (text) copyToClipboard(text, data => io.write(data))
        return
    }

    if (mouse.type !== 'press' && mouse.type !== 'scroll') return

    if (mouse.button === 'left') {
        const target = hitTest(root, layout, mouse.col, mouse.row)
        const fieldBox = target && isEditableField(target) ? layout.get(target.id) : undefined
        if (target && fieldBox) {
            // Clicks in an editable field drive the field caret/selection;
            // the screen-space selection clears so highlights don't fight.
            if (selection.clear()) redrawSelection()
            handleFieldClick(target, fieldBox, mouse, ctx, io)
        } else {
            const hadSelection = selection.range() !== null
            selection.onPress(mouse.col, mouse.row)
            if (hadSelection || selection.range() !== null) redrawSelection()
        }
        if (target) {
            // Disabled interactive elements swallow the click, as in browsers
            if (FOCUSABLE_TAGS.has(target.tag ?? '') && hasBooleanAttribute(target, 'disabled')) return
            if (FOCUSABLE_TAGS.has(target.tag ?? '')) {
                focusManager.focusByNode(target)
            }
            if (isCheckableInput(target)) toggleCheckable(target)
            const event = dispatchEvent(target, 'click', mouse)
            if (!event.defaultPrevented && target.tag === 'a') {
                const href = target.attributes.get('href')
                if (href) openUrl(href)
            }
            if (!event.defaultPrevented && target.tag === 'summary') toggleDetails(target)
            if (!event.defaultPrevented && target.tag === 'select') cycleSelect(target, 1)
            // Clicking a label activates its control, as in browsers
            if (!event.defaultPrevented) {
                const control = labelledControl(target)
                if (control && control !== target && !hasBooleanAttribute(control, 'disabled')) {
                    if (FOCUSABLE_TAGS.has(control.tag ?? '')) focusManager.focusByNode(control)
                    if (isCheckableInput(control)) toggleCheckable(control)
                }
            }
            scheduleRender()
        }
    } else if (mouse.button === 'scrollLeft' || mouse.button === 'scrollRight') {
        const target = hitTest(root, layout, mouse.col, mouse.row)
        if (target) {
            const scrollTarget = findScrollableAncestor(target, lastStyles)
            if (scrollTarget) {
                const box = layout.get(scrollTarget.id)
                if (box) {
                    const { width: contentWidth } = contentExtent(scrollTarget, layout, box)
                    const viewportWidth = scrollTarget.tag === 'root'
                        ? io.getSize().width
                        : box.width
                    const maxScroll = Math.max(0, contentWidth - viewportWidth)
                    const delta = mouse.button === 'scrollLeft' ? -1 : 1
                    scrollTarget.scrollLeft = Math.max(0, Math.min(scrollTarget.scrollLeft + delta, maxScroll))
                    scrollTarget.hScrollbarVisibleUntil = Date.now() + SCROLLBAR_TOTAL_MS
                    const forceRepaint = () => { ctx.queue.setFullRecompute(); scheduleRender() }
                    const frameInterval = SCROLLBAR_FADE_MS / SCROLLBAR_FADE_FRAMES
                    for (let i = 0; i <= SCROLLBAR_FADE_FRAMES; i++) {
                        setTimeout(forceRepaint, SCROLLBAR_VISIBLE_MS + i * frameInterval)
                    }
                    ctx.onScroll(scrollTarget)
                }
            }
            dispatchEvent(target, 'scroll', mouse)
            scheduleRender()
        }
    } else if (mouse.button === 'scrollUp' || mouse.button === 'scrollDown') {
        const target = hitTest(root, layout, mouse.col, mouse.row)
        if (target) {
            const scrollTarget = findScrollableAncestor(target, lastStyles)
            if (scrollTarget) {
                const box = layout.get(scrollTarget.id)
                if (box) {
                    const { height: contentHeight } = contentExtent(scrollTarget, layout, box)
                    const viewportHeight = scrollTarget.tag === 'root'
                        ? io.getSize().height
                        : box.height
                    const maxScroll = Math.max(0, contentHeight - viewportHeight)
                    const delta = mouse.button === 'scrollUp' ? -1 : 1
                    scrollTarget.scrollTop = Math.max(0, Math.min(scrollTarget.scrollTop + delta, maxScroll))
                    scrollTarget.scrollbarVisibleUntil = Date.now() + SCROLLBAR_TOTAL_MS
                    const forceRepaint = () => { ctx.queue.setFullRecompute(); scheduleRender() }
                    const frameInterval = SCROLLBAR_FADE_MS / SCROLLBAR_FADE_FRAMES
                    for (let i = 0; i <= SCROLLBAR_FADE_FRAMES; i++) {
                        setTimeout(forceRepaint, SCROLLBAR_VISIBLE_MS + i * frameInterval)
                    }
                    ctx.onScroll(scrollTarget)
                }
            }
            dispatchEvent(target, 'scroll', mouse)
            scheduleRender()
        }
    }
}


const FOCUSABLE_TAGS = new Set(['button', 'input', 'textarea', 'a', 'select', 'summary'])

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
        // Root element is implicitly scrollable (it's the viewport)
        if (current.tag === 'root') return current
        const style = styles?.get(current.id)
        if (style && (style.overflow === 'scroll' || style.overflow === 'auto' || style.overflow === 'hidden')) {
            return current
        }
        current = current.parent
    }
    return null
}

/** Clamp scroll positions on all nodes after resize/relayout. */
function clampScrollPositions(node: TermNode, layout: Map<number, LayoutBox>, io: TerminalIO): void {
    if (node.scrollTop !== 0 || node.scrollLeft !== 0) {
        const box = layout.get(node.id)
        if (box) {
            const extent = contentExtent(node, layout, box)
            const viewH = node.tag === 'root' ? io.getSize().height : box.height
            const viewW = node.tag === 'root' ? io.getSize().width : box.width
            const maxScrollY = Math.max(0, extent.height - viewH)
            const maxScrollX = Math.max(0, extent.width - viewW)
            if (node.scrollTop > maxScrollY) node.scrollTop = maxScrollY
            if (node.scrollLeft > maxScrollX) node.scrollLeft = maxScrollX
        }
    }
    for (const child of node.children) clampScrollPositions(child, layout, io)
}

/** Find the maximum content extent of all descendants relative to the ancestor's position. */
function contentExtent(
    node: TermNode,
    layout: Map<number, LayoutBox>,
    ancestorBox: LayoutBox,
): { width: number; height: number } {
    let maxW = 0
    let maxH = 0
    function walk(n: TermNode) {
        const box = layout.get(n.id)
        if (box) {
            maxW = Math.max(maxW, box.x - ancestorBox.x + box.width)
            maxH = Math.max(maxH, box.y - ancestorBox.y + box.height)
        }
        for (const child of n.children) walk(child)
    }
    for (const child of node.children) walk(child)
    return { width: maxW, height: maxH }
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

function collectInjectedCss(root: TermNode): string {
    const parts: string[] = []
    for (const child of root.children) {
        if (child.tag === 'style') {
            parts.push(child.collectText())
        }
    }
    return parts.join('\n')
}

export { TermNode } from './renderer/node.js'
export { CellBuffer } from './render/buffer.js'
export { parseCSS } from './css/parser.js'
export { resolveStyles } from './css/compute.js'
export { StdinRouter } from './terminal/stdin-router.js'
export { type TerminalIO, ProcessIO, InProcessIO } from './terminal/io.js'
export { copyToClipboard, osc52Copy } from './terminal/clipboard.js'
export { FrameLog, createFrameLog } from './framelog.js'
export { type Clock, TestClock, systemClock } from './render/clock.js'
