# Svelterm Plan

## Done

- Core renderer with stateless architecture (node-owned ctx)
- CSS engine: selectors, specificity, cascade, inheritance, scoped styles, var(), calc(), @media, @keyframes, :focus, :hover
- Flexbox layout on cell grid
- Terminal rendering with ANSI colors (16, 256, truecolor), differential output
- Incremental rendering: paint-only, style-resolve, layout-subtree, layout-bubble paths
- Input: keyboard, mouse (click, scroll, motion), focus management, bracketed paste
- Text input with readline-like editing (TextBuffer)
- Color scheme detection via OSC 11
- Debug server with Console domain
- 7 demos: counter, dashboard, todo, showcase, keyboard-hero, snake, themes
- 0.1.0 release prep: README, LICENSE, package exports

## CSS completeness

Done — see `DESIGN-browser-compat.md` (all 12 slices shipped) and
`docs/reference.md` for the full support matrix.

## Input & interaction

Done (0.8.0) — Ctrl+Z suspend/resume, Ctrl+D via exitOn, modal <dialog>
key capture, kitty keyboard protocol.

## Rendering quality

Done in 0.5.0: synchronized output (gated on DECRQM), capability
detection (XTVERSION + env), colour degradation truecolor → 256 → 16 →
mono. Remaining:

- Virtual scrolling for large lists
- DECSTBM hardware scroll regions

## Text & content

Done in 0.9.0: <svt-ansi> raw ANSI passthrough, ellipsis-middle
truncation, word-break control. Remaining:

- Syntax highlighting (tree-sitter)
- Markdown rendering component

## Terminal features

Done: cursor shape (0.6.0), clipboard (0.6.0), text selection (0.6.0),
inline rendering mode + FrameLog (0.7.0), alpha compositing (0.10.0).
Remaining:

- Image rendering (half-block, sixel/kitty protocol)

## Developer experience

Done (0.4.0) — `svelterm init/dev/build`, terminal-env .svelte compile
without vite-plugin-svelte, console forwarding to the vite terminal.

## Debug protocol

Infrastructure is in place (WebSocket server, Console domain). Remaining:

- DOM domain: tree inspection, querySelector, live attribute editing, mutation events
- CSS domain: computed/matched styles, live style editing
- Layout domain: box model inspection
- Overlay domain: node highlighting, inspect mode
- Render domain: queue inspection, buffer snapshot, performance timing
- Input domain: focus state, event simulation
- CLI client (`svt`): connect, send request, print result
- DevTools TUI: tree view, style inspector, layout visualisation, console (built with svelterm)

## @svelterm/vt100

VT100 state machine: ANSI parser, cell grid, cursor, SGR, alternate screen buffer. Shared by:
- svelterm-site: renders cell grid to DOM for live terminal preview
- @svelterm/ui: renders cell grid to svelterm cells for embedded terminal pane

## @svelterm/ui

Component library: dialog, selectable list, tabs, progress bar, fuzzy picker, toast, diff renderer, file browser, table, gradient text, embedded terminal pane.

## IO abstraction

Abstract svelterm's terminal output/input so it can target:
- Passthrough: real terminal stdout/stdin (current behaviour)
- In-process: JS-side consumer (VT100 emulator in browser)

## Demos to build

- ~~File browser (scrolling, mouse, tree navigation)~~ — shipped as `npm run demo:files` (2026-07-07)
- ~~Markdown viewer~~ — shipped as `npm run demo:markdown` (2026-07-07)
- ~~Color palette (16, 256, 24-bit side by side)~~ — shipped as `npm run demo:palette` (2026-07-07)
- svmux (multi-pane terminal multiplexer)
- Sveditor (content-editable with syntax highlighting)
- Dual-target (same component in terminal and web)

## Documentation & community

- API reference, getting started guide, CSS property reference
- Blog post: architecture, "why CSS for terminals"
- Follow up on svelte-custom-renderer branch stabilisation
