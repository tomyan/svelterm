# Svelterm Design

Standard Svelte 5 components rendered to the terminal. Real CSS.

## Overview

Svelterm is a custom renderer for Svelte 5 that targets the terminal. You write standard `.svelte` components with standard `<style>` blocks. They render in the terminal with ANSI escape sequences — and in the browser without the custom renderer. Same CSS, two surfaces.

The CSS is what makes this different from every other terminal UI framework. No other terminal renderer has a CSS engine. Ink, Bubble Tea, Ratatui — all use inline style props or imperative styling. Svelterm uses Svelte's scoped CSS, unchanged.

## Architecture

```
.svelte files → Svelte compiler (with customRenderer option)
                    ↓
        compiled JS (calls createRenderer interface, not DOM)
                    ↓
        svelterm renderer (stateless)
        ├── virtual node tree (TermNode, with ctx for mutation tracking)
        ├── CSS engine (parse, match, cascade, compute, media queries)
        ├── layout engine (flexbox on cell grid)
        ├── terminal renderer (cell buffer, diff, ANSI escape sequences)
        └── input handler (stdin → keyboard/mouse events)
```

### Custom Renderer

Svelte 5's custom renderer API (`experimental.customRenderer`) replaces DOM operations with calls to a renderer interface. The compiled component imports the renderer as a default export and calls its methods for all tree manipulation.

The renderer is **stateless** — a single module-level instance created by `createRenderer()`. It has no per-mount context. Instead, each `TermNode` carries a `ctx: RenderContext | null` property that tracks mutations for the mount it belongs to. Renderer methods read `node.ctx` to determine whether and how to track changes.

Context propagation:
- When a node is inserted into a tree, it inherits `ctx` from its parent
- When a node is removed, its `ctx` is cleared
- The root node's `ctx` is set by `run()` at mount time

This allows a single renderer instance to serve multiple independent mounts (each with their own render queue and scheduling).

### Virtual Node Tree

```typescript
class TermNode {
    id: number
    nodeType: 'element' | 'text' | 'comment' | 'fragment'
    tag?: string
    text?: string
    ctx: RenderContext | null    // mutation tracking context
    parent: TermNode | null
    children: TermNode[]
    attributes: Map<string, string>
    listeners: Map<string, Set<Function>>
    scrollTop: number
    scrollLeft: number
    cache: RenderCache           // resolved style + layout box
}
```

### CSS Engine

Parses and applies CSS in a terminal context.

1. **Parse** — tokenise CSS into a rule tree (selectors, declarations, media queries, keyframes)
2. **Match** — resolve selectors against the virtual node tree (Svelte's scoped class hashes are just classes)
3. **Cascade** — apply specificity rules
4. **Compute** — resolve values into terminal-specific styles:
   - `color: cyan` → ANSI color code
   - `color: #ff0088` → truecolor escape sequence
   - `border: rounded` → box-drawing characters
   - `font-weight: bold` → SGR bold attribute
   - `display: flex` → flexbox layout mode
   - `padding: 1cell` → 1 cell padding
5. **Media queries** — `@media (display-mode: terminal)` as true, `@media (display-mode: screen)` as false. Also: `prefers-color-scheme`, dimension queries.

**Supported CSS features:** selectors (class, id, tag, descendant, child, sibling, attribute, pseudo-class), specificity, inheritance, scoped styles, `var()`, `calc()`, `@media`, `@keyframes`, `:focus`, `:hover`, `:active`.

**Layout properties:** `display`, `flex-direction`, `justify-content`, `align-items`, `align-self`, `gap`, `flex-grow`, `flex-shrink`, `flex-basis`, `width`, `height`, `min-width`, `min-height`, `max-width`, `max-height`, `padding`, `margin`, `position`, `top`, `right`, `bottom`, `left`, `z-index`, `overflow`, `order`, `flex-wrap`.

**Visual properties:** `color`, `background-color`, `font-weight`, `font-style`, `text-decoration`, `text-align`, `white-space`, `text-overflow`, `opacity`, `visibility`.

**Terminal-specific:** `border` (`single`|`double`|`rounded`|`heavy`|`none`), `border-color`, `border-title`, `opacity: dim`.

### Layout Engine

Pure TypeScript flexbox on a cell grid. Integer coordinates.

Input: virtual node tree with resolved styles.
Output: `LayoutBox` per node: `{ x, y, width, height }`.

Text measurement: monospace, character count = width. Wrapping computed per available width.

### Incremental Rendering

Mutations are classified by minimum required work:

| Mutation | Path |
|----------|------|
| Text change, same length | Paint-only |
| Text change, different length | Layout-bubble (up to fixed-size ancestor) |
| Class/id change | Style-resolve + descendants |
| Node insert/remove, fixed-size parent | Layout-subtree |
| Node insert/remove, auto-size parent | Layout-bubble |
| Terminal resize | Full recompute |

`RenderContext` enqueues work into a `RenderQueue` with four tiers: `paintOnly`, `styleResolve`, `layoutSubtree`, `layoutBubble`. After all Svelte effects settle (microtask boundary), the queue is processed: style → layout → paint → diff → output.

Each `TermNode` caches its resolved style and layout box. Caches are invalidated selectively based on what changed.

### Terminal Renderer

Cell-based double-buffer with differential output.

```typescript
interface Cell {
    char: string
    fg: number        // 0xRRGGBB or ANSI index
    bg: number
    style: number     // bit flags: bold, italic, underline, dim, strikethrough, inverse
}
```

Pipeline: walk tree in paint order → fill cells (backgrounds, borders, text) → clip to overflow bounds → diff against previous buffer → write ANSI escape sequences.

Color support: ANSI 16, 256-color, truecolor. Color scheme detection via OSC 11 terminal query, polled in background.

### Input Handler

Reads raw stdin, parses terminal escape sequences into structured events.

**Keyboard:** regular characters, special keys (arrows, Enter, Escape, Backspace, Delete, Home, End, Page Up/Down, Tab), modifier detection (Ctrl, Alt, Shift), bracketed paste.

**Mouse:** SGR mouse protocol (click, scroll wheel, motion tracking), hit-testing against layout tree.

**Focus:** Tab/Shift-Tab cycling, `:focus` pseudo-class triggers CSS re-evaluation.

**Events:** dispatched to virtual node listeners, bubble up the tree.

### CSS Registration

Svelte compiles with `css: 'external'` — CSS is extracted by Vite and passed to `run()` as a string. The CSS engine matches against Svelte's scoped class hashes like any other class.

### Debug Protocol

CDP-inspired WebSocket protocol for runtime inspection. Enabled with `run(App, { debug: true })`.

**Implemented:** Console domain — pipes `console.log/warn/error` to connected clients.

**Designed (not yet implemented):** DOM inspection (tree, attributes, querySelector), CSS inspection (computed/matched styles, live edit), Layout inspection (box model), Overlay (highlight nodes, inspect mode), Render (queue, buffer, performance timing), Input (focus, simulate events), Runtime (color scheme, terminal size).

The debug server infrastructure (WebSocket, message routing) is in place. A CLI client (`svt`) and DevTools TUI (built with svelterm itself) are planned.

## Package Exports

| Import | Purpose |
|--------|---------|
| `svelterm` (default) | Renderer instance for the Svelte compiler |
| `svelterm/app` | `run()` function and public API |
| `svelterm/headless` | Headless rendering for tests |

## Package Ecosystem

| Package | Purpose |
|---------|---------|
| `svelterm` | Core renderer, CSS engine, layout, input, IO |
| `@svelterm/vt100` | VT100 state machine — ANSI → cell grid (no rendering opinion) |
| `@svelterm/ui` | Higher-level components: dialog, tabs, list, embedded terminal pane |

## What Svelterm Is Not

- **Not a component library.** The renderer. Components are standard Svelte. `@svelterm/ui` is separate.
- **Not a framework.** No routing, no data loading. Those are SvelteKit's job.
- **Not a terminal emulator.** That's `@svelterm/vt100`. Svelterm renders Svelte components to the terminal.
