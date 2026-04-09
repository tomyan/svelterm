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

- display: contents, inline-block width verification
- Percentage heights
- calc(), min(), max(), clamp() evaluation at layout time
- inherit, initial, unset keywords
- currentColor
- Margin collapsing
- CSS Grid (display: grid)
- @supports, @container queries
- text-decoration inheritance fix

## Input & interaction

- Ctrl+Z suspend, Ctrl+D configurable
- Priority-based key routing (modal dialogs capture keys)
- Kitty keyboard protocol (CSI u)

## Rendering quality

- Synchronized output (DEC 2026 BSU/ESU)
- Virtual scrolling for large lists
- Terminal capability detection (DA1/DA2, XTVERSION)
- Color degradation: perceptual quantization for truecolor → 256 → 16
- DECSTBM hardware scroll regions

## Text & content

- Raw ANSI passthrough element
- Syntax highlighting (tree-sitter)
- Markdown rendering component
- Middle truncation, word-break control

## Terminal features

- Cursor shape control (DECSCUSR)
- Clipboard (OSC 52 + platform fallbacks)
- Text selection (mouse drag, double/triple click)
- Image rendering (half-block, sixel/kitty protocol)
- Inline rendering mode (non-alt-screen)
- Color blending / alpha compositing

## Developer experience

- Vite plugin (vite-plugin-svelterm): auto-configure compiler, CSS collection, dev mode HMR
- Dev CLI: `npx svelterm dev`, `npx svelterm build`

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

- File browser (scrolling, mouse, tree navigation)
- Markdown viewer
- Color palette (16, 256, 24-bit side by side)
- svmux (multi-pane terminal multiplexer)
- Sveditor (content-editable with syntax highlighting)
- Dual-target (same component in terminal and web)

## Documentation & community

- API reference, getting started guide, CSS property reference
- Blog post: architecture, "why CSS for terminals"
- Follow up on svelte-custom-renderer branch stabilisation
