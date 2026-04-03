# Svelterm Design

Standard Svelte 5 components rendered to the terminal. Real CSS. Zero dependencies beyond Svelte.

## Overview

Svelterm is a custom renderer for Svelte 5 that targets the terminal. You write standard `.svelte` components with standard `<style>` blocks. They render in the browser as normal. They also render in the terminal — same CSS, interpreted by a terminal-aware CSS engine that maps flexbox to a cell grid.

The CSS is what makes this different from every other terminal UI framework. No other terminal renderer has a CSS engine. Ink, Bubble Tea, Ratatui, OpenTUI, SvelTUI — all use inline style props or imperative styling. Svelterm uses Svelte's scoped CSS, unchanged.

```svelte
<script>
    let count = $state(0)
</script>

<style>
    .counter {
        display: flex;
        flex-direction: column;
        border: single;
        border-color: cyan;
        padding: 1;
        gap: 1;
    }

    .value {
        color: yellow;
        font-weight: bold;
    }

    @media (display-mode: screen) {
        .counter {
            border: 1px solid cyan;
            border-radius: 4px;
            padding: 0.5rem;
        }
    }
</style>

<div class="counter">
    <span>Count:</span>
    <span class="value">{count}</span>
    <button onclick={() => count++}>Increment</button>
</div>
```

This component works in a browser and in the terminal. The `@media (display-mode: screen)` block adds browser-specific styles. The base styles use terminal-compatible values that the CSS engine interprets directly.

## Why

### LLMs know CSS and Svelte

Every frontier model has been trained on enormous amounts of CSS and Svelte. An AI agent generating Svelterm components is writing standard code — no novel APIs, no framework-specific styling DSL. This matters because UI development is increasingly agentic.

### Svelte already solved the hard problems

Single-file components, scoped CSS, fine-grained reactivity, a compiler that generates optimal update code, editor tooling, HMR — Svelte has all of this. Building a custom terminal framework means rebuilding all of it, worse. Svelterm adds a renderer and a CSS engine; Svelte provides everything else.

### The web target is free

Same `.svelte` component, remove the custom renderer option, and it renders in a browser. CSS media queries select the right rules per target. One component, two surfaces.

## Architecture

```
.svelte files → Svelte compiler (with customRenderer option)
                    ↓
        compiled JS (calls createRenderer interface, not DOM)
                    ↓
        svelterm renderer
        ├── virtual node tree (not DOM)
        ├── CSS engine (parses scoped CSS, resolves selectors, computes styles)
        ├── layout engine (flexbox on cell grid)
        ├── terminal renderer (cell buffer, diff, ANSI escape sequences)
        └── input handler (stdin → keyboard/mouse events)
```

### Custom Renderer

Svelte 5's custom renderer API (PR #18042, `experimental.customRenderer`) replaces DOM operations with calls to a renderer interface. The compiler emits `$.from_tree([...])` instead of `$.from_html("...")`, and all element creation, attribute setting, and tree manipulation goes through the renderer.

Svelterm implements `createRenderer()` from `svelte/renderer`:

```typescript
import { createRenderer } from 'svelte/renderer'

const renderer = createRenderer({
    createElement(name: string): TermNode { ... },
    createTextNode(data: string): TermNode { ... },
    createComment(data: string): TermNode { ... },
    setText(node: TermNode, text: string): void { ... },
    setAttribute(el: TermNode, key: string, value: string): void { ... },
    removeAttribute(el: TermNode, name: string): void { ... },
    getFirstChild(el: TermNode): TermNode | null { ... },
    getNextSibling(node: TermNode): TermNode | null { ... },
    insert(parent: TermNode, node: TermNode, anchor?: TermNode): void { ... },
    remove(node: TermNode): void { ... },
    addEventListener(target: TermNode, type: string, handler: Function): void { ... },
    removeEventListener(target: TermNode, type: string, handler: Function): void { ... },
    // ~15 methods total
})
```

Each call creates or mutates nodes in a virtual tree. After mutations settle (microtask boundary), the renderer runs the CSS engine, layout engine, and terminal renderer pipeline.

### Virtual Node Tree

```typescript
interface TermNode {
    id: number
    type: 'element' | 'text' | 'comment'
    tag?: string                         // div, span, button, etc.
    text?: string
    classes: Set<string>                 // includes Svelte scoped hashes
    attributes: Map<string, string>
    children: TermNode[]
    parent?: TermNode
    listeners: Map<string, Set<Function>>

    // Computed by CSS + layout:
    resolvedStyle?: ResolvedStyle
    layout?: LayoutBox                   // x, y, width, height
}
```

### CSS Engine

The core IP. Parses and applies CSS in a terminal context.

**Input:** Svelte's compiled CSS output — a string of scoped CSS rules:

```typescript
const $$css = {
    hash: 'svelte-abc123',
    code: '.counter.svelte-abc123 { display: flex; border: single; border-color: cyan; }'
}
```

**What the CSS engine does:**

1. **Parse** — tokenise and parse CSS into a rule tree (selectors, declarations, media queries)
2. **Match** — resolve selectors against the virtual node tree. Svelte's scoped class hashes are just classes — the engine matches them like any other class selector.
3. **Cascade** — apply specificity rules (simplified: flat, no `!important`). Later rules win at equal specificity.
4. **Compute** — resolve property values into terminal-specific styles:
   - `color: cyan` → ANSI color code
   - `color: #ff0088` → truecolor escape sequence
   - `border: single` → box-drawing characters (terminal-specific property)
   - `font-weight: bold` → SGR bold attribute
   - `display: flex` → flexbox layout mode
   - `padding: 1` → 1 cell padding
   - `gap: 2` → 2 cell gap
5. **Media queries** — evaluate `@media (display-mode: terminal)` as true, `@media (display-mode: screen)` as false. Also: `@media (width > N)`, `@media (height > N)`, `@media (color-depth: truecolor|256color|ansi)`.

**CSS properties supported:**

Layout: `display`, `flex-direction`, `justify-content`, `align-items`, `align-self`, `gap`, `flex-grow`, `flex-shrink`, `width`, `height`, `min-width`, `min-height`, `max-width`, `max-height`, `padding`, `margin`, `position`, `top`, `right`, `bottom`, `left`, `z-index`, `overflow`

Text: `color`, `background-color`, `font-weight` (bold), `font-style` (italic), `text-decoration` (underline, line-through), `text-align`, `white-space`, `text-overflow`

Terminal-specific: `border` (single|double|rounded|heavy|none), `border-color`, `border-title`, `visibility`

Pseudo-classes: `:focus`, `:active`

**CSS properties intentionally excluded:**

`font-family`, `font-size`, `transform`, `box-shadow`, `border-radius` (use `border: rounded`), `float`, `!important`, `opacity` (terminal cells are opaque)

### Layout Engine

Pure TypeScript flexbox implementation operating on a cell grid. Integer coordinates — no sub-pixel rendering.

**Input:** virtual node tree with resolved styles
**Output:** `LayoutBox` per node: `{ x, y, width, height }`

Supports:
- `flex-direction`: row, column
- `justify-content`: start, end, center, space-between, space-around, space-evenly
- `align-items`: start, end, center, stretch
- `gap`: cell spacing
- `flex-grow`, `flex-shrink`: proportional sizing
- `padding`, `margin`: cell insets/outsets
- `width`, `height`: fixed cells, percentage, auto
- `min-*`, `max-*`: constraints
- `position: absolute/relative/fixed`: positioned elements
- `overflow: hidden/scroll/auto`: clipping and scrolling

Text measurement: monospace, so character count = width. Wrapping computed per available width.

### Terminal Renderer

Cell-based double-buffer with differential output.

```typescript
interface Cell {
    char: string      // single character
    fg: number        // 0xRRGGBB or ANSI index
    bg: number        // 0xRRGGBB or ANSI index
    style: number     // bit flags: bold, italic, underline, dim, strikethrough, inverse
}
```

**Render pipeline:**

1. Walk the virtual node tree in paint order (z-index sorted)
2. For each node, apply its resolved style and layout box
3. Fill cells in the buffer: backgrounds, borders (box-drawing characters), text content
4. Clip to parent overflow bounds
5. Diff against previous buffer — only changed cells produce output
6. Write ANSI escape sequences to stdout: cursor positioning + SGR codes + characters
7. Swap buffers

**Terminal features:**
- Alternate screen mode (full-screen app)
- Synchronized output (DEC 2026 BSU/ESU) to prevent flicker
- SIGWINCH handling for resize
- Color support detection and graceful degradation (truecolor → 256 → 16)

### Input Handler

Reads raw stdin, parses terminal escape sequences into structured events.

**Keyboard:**
- Regular characters, special keys (arrows, Enter, Escape, Backspace, Delete, Home, End, Page Up/Down, Tab)
- Modifier detection: Ctrl, Alt, Shift
- Kitty keyboard protocol (CSI u) when available, with ANSI fallback
- Bracketed paste detection

**Mouse:**
- SGR mouse protocol (CSI < button;col;row M/m)
- Click, scroll wheel, motion tracking
- Hit-testing against layout tree to determine target node

**Focus:**
- Tab / Shift-Tab cycling through focusable elements
- `:focus` pseudo-class triggers CSS re-evaluation and repaint

**Event dispatch:**
- Events dispatched to the virtual node's registered listeners (from Svelte's compiled `addEventListener` calls)
- Bubble up the tree (stopPropagation supported)

### CSS Registration

Svelte's compiled output calls `$.append_styles(anchor, $$css)` to inject CSS. With the custom renderer, this is forbidden (`css: 'injected'` is disallowed). Instead, Svelterm uses `css: 'external'` mode:

- The Vite plugin extracts CSS from compiled components
- CSS is collected and passed to Svelterm's CSS engine at app startup
- When components mount, their scoped class hashes are already on the elements
- The CSS engine matches against these hashes like any other class

## Development Experience

### Vite Plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelterm } from 'vite-plugin-svelterm'

export default defineConfig({
    plugins: [svelte(), svelterm()]
})
```

The `svelterm` Vite plugin:

1. Sets `compilerOptions.customRenderer` to `'svelterm/renderer'`
2. Sets `compilerOptions.css` to `'external'`
3. Collects extracted CSS from all compiled components
4. In dev mode: starts terminal preview, connects HMR
5. In build mode: bundles for Bun/Node execution

### Dev Mode

```bash
npx svelterm dev          # terminal preview with HMR
npx svelterm dev --web    # browser preview (standard Svelte)
npx svelterm dev --dual   # both side by side
```

**HMR granularity:**

| Change | Update | State |
|---|---|---|
| `<style>` only | Hot-swap CSS, repaint | Preserved |
| Template only | Re-mount render function | Preserved |
| `<script>` | Full component remount | Resets |

### Build

```bash
npx svelterm build        # bundle for bun/node
bun dist/app.js           # run the terminal app
```

## Element Mapping

Standard HTML elements map to terminal representations:

| HTML element | Terminal rendering |
|---|---|
| `<div>` | Block container (flexbox) |
| `<span>` | Inline text |
| `<p>` | Block text with margin |
| `<h1>`–`<h6>` | Bold text, decreasing emphasis |
| `<button>` | Focusable, activatable, bordered |
| `<input>` | Monospace text input |
| `<textarea>` | Multi-line monospace text input |
| `<a>` | OSC 8 hyperlink (where supported) |
| `<ul>`, `<ol>`, `<li>` | List with bullets/numbers |
| `<table>`, `<tr>`, `<td>` | Table layout |
| `<hr>` | Horizontal divider |
| `<pre>`, `<code>` | Monospace text block |
| `<img>` | Half-block image (truecolor) or alt text fallback |

Unsupported elements render as block containers with a dev-mode warning.

## Event Mapping

| Browser event | Terminal equivalent |
|---|---|
| `click` | Enter on focused element, or mouse click |
| `keydown` | Terminal key event |
| `input` | Text input value change |
| `focus` / `blur` | Focus management |
| `scroll` | Scroll wheel, Page Up/Down |
| `mousedown` / `mouseup` | Mouse button events |
| `resize` | SIGWINCH |

## Theming

CSS custom properties work in both targets:

```css
:root {
    --primary: cyan;
    --bg: black;
    --text: white;
}

@media (display-mode: screen) {
    :root {
        --primary: #00b4d8;
        --bg: #1a1a2e;
        --text: #eaeaea;
    }
}

.container {
    color: var(--text);
    background-color: var(--bg);
    border-color: var(--primary);
}
```

Terminal gets ANSI `cyan`, `black`, `white`. Browser gets hex colors. Same component, same stylesheet.

## Package Structure

```
svelterm/
├── src/
│   ├── renderer/          # createRenderer() implementation
│   │   ├── index.ts       # renderer factory, mount/unmount
│   │   └── node.ts        # TermNode virtual tree
│   ├── css/               # CSS engine
│   │   ├── parser.ts      # CSS tokeniser and parser
│   │   ├── selector.ts    # selector matching against node tree
│   │   ├── cascade.ts     # specificity and cascade resolution
│   │   ├── compute.ts     # property value computation (terminal-specific)
│   │   └── media.ts       # media query evaluation
│   ├── layout/            # flexbox layout engine
│   │   ├── engine.ts      # layout computation
│   │   ├── flex.ts        # flex-direction, justify, align, gap
│   │   ├── size.ts        # width/height/min/max resolution
│   │   └── text.ts        # text measurement and wrapping
│   ├── render/            # terminal output
│   │   ├── buffer.ts      # cell buffer (double-buffered)
│   │   ├── diff.ts        # buffer diff → ANSI output
│   │   ├── paint.ts       # node tree → cell buffer
│   │   ├── border.ts      # box-drawing character rendering
│   │   └── ansi.ts        # ANSI escape sequence helpers
│   ├── input/             # terminal input
│   │   ├── keyboard.ts    # raw stdin → key events
│   │   ├── mouse.ts       # SGR mouse protocol → mouse events
│   │   └── focus.ts       # focus management, Tab cycling
│   ├── terminal/          # terminal setup
│   │   ├── capabilities.ts # detect color depth, size, features
│   │   ├── screen.ts      # alternate screen, raw mode, cleanup
│   │   └── resize.ts      # SIGWINCH handling
│   └── index.ts           # public API: mount(component, options)
├── vite-plugin/
│   └── index.ts           # vite-plugin-svelterm
├── package.json
└── tsconfig.json
```

**Public API:**

```typescript
import { mount } from 'svelterm'
import App from './App.svelte'

mount(App, {
    target: process.stdout,
    fullscreen: true,      // alternate screen mode
    mouse: true,           // enable mouse tracking
})
```

## What Svelterm Is Not

- **Not a component library.** Svelterm is the renderer. Components are standard Svelte components. A component library (dialogs, lists, tables, etc.) is a separate package built on top.
- **Not a framework.** No routing, no data loading, no SSR. Those are SvelteKit's job. A SvelteKit adapter for terminal is a future project.
- **Not a general-purpose terminal library.** No PTY management, no process spawning, no terminal emulation. Just rendering Svelte components to the terminal.
