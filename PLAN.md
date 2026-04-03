# Svelterm Plan

Iterative plan. Each iteration delivers a working (if incomplete) package. Ordered by value — smallest slices that a human can use and verify.

## Iteration 1: Render a div with text

**Goal:** A Svelte component renders to the terminal. No CSS, no layout engine, no input. Just proof that the custom renderer pipeline works end-to-end.

**What to build:**
- `src/renderer/node.ts` — TermNode class (virtual tree)
- `src/renderer/index.ts` — implement `createRenderer()` against Svelte's API (PR #18042)
- `src/render/buffer.ts` — simple cell buffer (width × height grid)
- `src/render/paint.ts` — walk node tree, write text content to buffer cells (top-left, no layout)
- `src/render/ansi.ts` — cursor positioning, basic SGR codes
- `src/terminal/screen.ts` — alternate screen enter/exit, raw mode
- `src/index.ts` — `mount(Component, { target: process.stdout })`

**Test component:**
```svelte
<div>Hello from Svelterm</div>
```

**Validation:**
- `bun run app.ts` renders "Hello from Svelterm" in alternate screen
- Ctrl+C exits cleanly (restore terminal state)
- Test: mount component, assert buffer contains expected text

---

## Iteration 2: CSS engine — parse and apply scoped styles

**Goal:** Svelte's `<style>` block works. Colors and text styling render in the terminal.

**What to build:**
- `src/css/parser.ts` — tokenise CSS string into rules (selector + declarations)
- `src/css/selector.ts` — match class selectors against TermNode (`.foo.svelte-hash`)
- `src/css/cascade.ts` — specificity resolution (simplified: last matching rule wins at equal specificity)
- `src/css/compute.ts` — resolve values: `color: cyan` → fg color, `font-weight: bold` → bold flag, `background-color` → bg color
- Integrate with renderer: after tree mutation settles, run CSS resolution before paint

**Test component:**
```svelte
<style>
    .greeting { color: cyan; font-weight: bold; }
    .name { color: yellow; }
</style>

<div>
    <span class="greeting">Hello</span>
    <span class="name">World</span>
</div>
```

**Validation:**
- "Hello" renders in cyan+bold, "World" in yellow
- Scoped class hashes (`.greeting.svelte-abc123`) match correctly
- Test: mount component, assert cells have correct color attributes

---

## Iteration 3: Flexbox layout — direction, padding, sizing

**Goal:** Components lay out with flexbox. Not just text at (0,0).

**What to build:**
- `src/layout/engine.ts` — layout pass: traverse tree, compute LayoutBox per node
- `src/layout/flex.ts` — flex-direction (row/column), padding, gap, width/height (fixed and percentage)
- `src/layout/size.ts` — auto-sizing from content, min/max constraints
- `src/layout/text.ts` — text measurement (character count for monospace), word wrapping
- `src/render/paint.ts` — update to use layout boxes for positioning
- `src/css/compute.ts` — add layout property resolution (display, flex-direction, padding, gap, width, height)

**Test component:**
```svelte
<style>
    .container {
        display: flex;
        flex-direction: row;
        gap: 2;
        padding: 1;
    }
    .box {
        width: 20;
        padding: 1;
        background-color: blue;
    }
</style>

<div class="container">
    <div class="box">Left</div>
    <div class="box">Right</div>
</div>
```

**Validation:**
- Two boxes side by side, 2 cells apart, each 20 cells wide with 1 cell padding
- Blue background fills each box
- Test: assert layout positions and dimensions

---

## Iteration 4: Borders

**Goal:** Terminal-specific border rendering with box-drawing characters.

**What to build:**
- `src/render/border.ts` — box-drawing character sets (single, double, rounded, heavy)
- `src/css/compute.ts` — parse `border: single`, `border-color: cyan`
- `src/render/paint.ts` — render borders around nodes with border styles
- Border-aware layout: borders consume cells from content area

**Test component:**
```svelte
<style>
    .card {
        border: rounded;
        border-color: cyan;
        padding: 1;
    }
</style>

<div class="card">
    <span>Hello</span>
</div>
```

**Validation:**
- Rounded border characters in cyan surround the content
- Padding is inside the border
- Test: assert border characters at expected positions

---

## Iteration 5: Keyboard input and events

**Goal:** Keyboard events work. A component can respond to key presses.

**What to build:**
- `src/input/keyboard.ts` — raw stdin reader, escape sequence parser, key event generation
- `src/input/focus.ts` — focusable elements, Tab/Shift-Tab cycling, `:focus` pseudo-class
- `src/css/compute.ts` — `:focus` pseudo-class triggers style change
- Event dispatch: key events dispatched to focused node's listeners, bubble up tree

**Test component:**
```svelte
<script>
    let count = $state(0)
</script>

<style>
    button { border: single; padding: 0 1; }
    button:focus { border-color: cyan; color: cyan; }
</style>

<button onclick={() => count++}>Count: {count}</button>
```

**Validation:**
- Button is focusable, shows focus border when focused
- Enter key triggers onclick, count increments, display updates
- Tab moves focus between multiple buttons
- Test: simulate key events, assert state changes and repaint

---

## Iteration 6: Reactive updates and differential rendering

**Goal:** Fine-grained updates work correctly. Only changed cells are rewritten.

**What to build:**
- `src/render/diff.ts` — compare current buffer with previous, emit only changed cells
- `src/render/buffer.ts` — double-buffering (front buffer = last rendered, back buffer = current render)
- Batching: collect mutations during a microtask, run one render pass
- `src/terminal/resize.ts` — SIGWINCH handler, re-layout and full repaint on resize

**Test component:**
```svelte
<script>
    let time = $state(new Date().toLocaleTimeString())
    setInterval(() => time = new Date().toLocaleTimeString(), 1000)
</script>

<style>
    .clock { color: green; font-weight: bold; }
</style>

<div>
    <span>Time: </span>
    <span class="clock">{time}</span>
</div>
```

**Validation:**
- Clock updates every second, only the time characters are rewritten (not the entire screen)
- Terminal resize causes clean re-layout
- Test: mount, mutate state, assert diff output is minimal

---

## Iteration 7: Scrolling and overflow

**Goal:** Content that exceeds its container scrolls.

**What to build:**
- `src/css/compute.ts` — `overflow: hidden|scroll|auto`
- `src/render/paint.ts` — clipping to parent bounds
- Scroll state per node: scroll offset, content height vs visible height
- Keyboard scroll: arrow keys, Page Up/Down on focused scrollable
- Mouse scroll: wheel events
- Scrollbar rendering: track + thumb using block characters

**Test component:**
```svelte
<script>
    let items = $state(Array.from({ length: 50 }, (_, i) => `Item ${i}`))
</script>

<style>
    .list {
        height: 10;
        overflow: scroll;
        border: single;
    }
</style>

<div class="list">
    {#each items as item}
        <div>{item}</div>
    {/each}
</div>
```

**Validation:**
- List shows 10 items, scrollbar visible
- Arrow keys scroll one line, Page Up/Down scroll by page
- Mouse wheel scrolls
- Content clips at container boundary
- Test: assert visible items change with scroll offset

---

## Iteration 8: Mouse support

**Goal:** Click events work. Mouse-aware components.

**What to build:**
- `src/input/mouse.ts` — enable SGR mouse protocol, parse mouse escape sequences
- Hit testing: map terminal coordinates to layout tree nodes
- Click dispatch: find target node, fire click event, bubble
- Hover tracking (optional): mouse motion events, `:hover` pseudo-class

**Validation:**
- Click on a button triggers its onclick handler
- Click on a scrollable area and drag to scroll
- Test: simulate mouse events, assert correct target node receives event

---

## Iteration 9: Media queries

**Goal:** `@media (display-mode: terminal)` and responsive terminal queries work.

**What to build:**
- `src/css/media.ts` — parse and evaluate media queries
- `display-mode: terminal` — always true in svelterm, false in browser
- `display-mode: screen` — always false in svelterm, true in browser
- `width > N` / `height > N` — terminal dimensions
- `color-depth: truecolor|256color|ansi` — detected capability
- Re-evaluate on terminal resize (width/height queries may change)

**Test component:**
```svelte
<style>
    .container { display: flex; flex-direction: column; }

    @media (width > 80) {
        .container { flex-direction: row; }
    }

    @media (display-mode: screen) {
        .container { border: 1px solid gray; border-radius: 4px; }
    }

    @media (display-mode: terminal) {
        .container { border: rounded; border-color: gray; }
    }
</style>

<div class="container">
    <div>Panel A</div>
    <div>Panel B</div>
</div>
```

**Validation:**
- Narrow terminal: panels stack vertically. Wide terminal: side by side.
- Terminal gets rounded box-drawing border. Browser gets CSS border-radius.
- Resize terminal: layout updates, media queries re-evaluate.
- Test: mock terminal width, assert layout direction changes at breakpoint.

---

## Iteration 10: CSS custom properties (variables)

**Goal:** `var(--name)` works for theming.

**What to build:**
- `src/css/compute.ts` — resolve `var(--name)` and `var(--name, fallback)`
- `:root` selector support (matches the root node)
- Custom properties cascade through the tree (inherited)

**Validation:**
- Define `--primary: cyan` in `:root`, use `color: var(--primary)` in components
- Override in a child: `--primary: yellow` changes descendants
- Media-query-specific variable values work
- Test: assert resolved colors match variable definitions

---

## Iteration 11: Vite plugin

**Goal:** `vite dev` provides HMR for terminal development.

**What to build:**
- `vite-plugin/index.ts` — Vite plugin that:
  - Sets Svelte compiler options (`customRenderer`, `css: 'external'`)
  - Collects extracted CSS from compiled components
  - In dev mode: starts terminal preview subprocess, pipes HMR updates
  - In build mode: bundles for Bun/Node
- CSS hot-swap: style-only changes repaint without component remount
- Template changes: remount render function, preserve reactive state
- Script changes: full component remount

**Validation:**
- `npx svelterm dev` starts terminal preview
- Edit `<style>` block → terminal repaints instantly, state preserved
- Edit template → component remounts, state preserved
- Edit `<script>` → component remounts, state resets
- `npx svelterm build` produces a runnable bundle

---

## Iteration 12: Positioned elements and z-index

**Goal:** Overlays, dialogs, absolute positioning.

**What to build:**
- `src/layout/engine.ts` — position: absolute/fixed relative to containing block
- `src/render/paint.ts` — z-index-aware paint order
- `src/css/compute.ts` — top/right/bottom/left offset properties

**Validation:**
- A dialog component positions itself centered over content with position: fixed
- Z-index determines paint order (dialog renders over content)
- Test: assert z-ordered paint produces correct cell buffer

---

## Iteration 13: Terminal capabilities and color degradation

**Goal:** Detect terminal features, degrade gracefully.

**What to build:**
- `src/terminal/capabilities.ts` — detect color depth (truecolor, 256, 16), terminal size
- `src/render/ansi.ts` — emit appropriate color codes per detected depth
- `src/css/media.ts` — `@media (color-depth: ...)` evaluation from detected capabilities
- Graceful degradation: truecolor hex → nearest 256-color → nearest ANSI 16

**Validation:**
- In a truecolor terminal: hex colors render accurately
- In a 256-color terminal: hex colors map to nearest palette entry
- In a basic terminal: falls back to ANSI 16 colors
- Test: mock capabilities, assert correct ANSI codes emitted

---

## Iteration 14: Component library (separate package)

**Goal:** Reusable terminal components built as standard Svelte components with CSS.

**What to build (separate `svelterm-components` package):**
- `TextInput.svelte` — monospace input with cursor, selection, syntax highlighting
- `SelectableList.svelte` — keyboard-navigable list
- `Dialog.svelte` — centered overlay with backdrop
- `Spinner.svelte` — animated loading indicator
- `Table.svelte` — styled rows and columns
- `Tabs.svelte` — switchable tab bar
- `Markdown.svelte` — styled markdown rendering (tree-sitter for code blocks)
- `DiffView.svelte` — unified diff with syntax highlighting and add/remove coloring

Each component is a standard `.svelte` file with `<style>` blocks. They work in both terminal and browser (with appropriate media queries).

---

## Iteration 15: SvelteKit adapter (future)

**Goal:** SvelteKit apps target the terminal.

**What to build:**
- `adapter-svelterm` — SvelteKit adapter
- File-system routing → terminal screens/pages
- Layouts → nested terminal UI hierarchy
- Load functions → data loading (run directly, no HTTP)
- Navigation → keyboard-driven (Ctrl+1, Ctrl+2, or configurable)
- Strip SSR/hydration (not applicable)

This is a larger project that depends on Svelterm being stable and the custom renderer API being merged into Svelte.

---

## Testing Strategy

Each iteration includes tests at two levels:

**Unit tests:**
- CSS parser: input CSS string → parsed rule tree
- Selector matching: node tree + selector → matched nodes
- Layout engine: node tree + styles → layout boxes with positions
- Buffer diff: two buffers → minimal ANSI output

**Integration tests:**
- Mount a Svelte component, assert the cell buffer contains expected content
- Simulate key/mouse events, assert component state updates
- Simulate resize, assert re-layout produces correct output

Tests use Bun's built-in test runner (`bun test`). No additional test framework dependency.
