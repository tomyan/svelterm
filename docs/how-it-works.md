# How it works

svelterm is a Svelte custom renderer plus a CSS engine plus a terminal
painter. There is no DOM anywhere — not emulated, not shimmed. This page
walks the path from your component source to ANSI bytes on a terminal.

## No DOM

Svelte's compiler doesn't hardcode the DOM: compiled components call a
renderer interface — create an element, insert a node, set an attribute,
set text, listen for an event. In a browser that interface is backed by
`document`. svelterm (via the experimental
[custom renderer API](https://github.com/paoloricciuti/svelte/tree/svelte-custom-renderer))
supplies a different backing: every call builds and mutates a tree of
**`TermNode`** objects — plain values holding a tag, attributes, children,
event listeners, and a little render cache. No `document`, no `window`, no
JSDOM.

Everything Svelte does — reactivity, `$state`, effects, `{#if}`/`{#each}`
patching, component composition, scoped styles — works unchanged, because
Svelte only ever asks the renderer to make small tree mutations. Your
component doesn't know it's in a terminal; a handful of DOM-compat
properties on `TermNode` (`textContent`, `nodeValue`, `checked`, `value`)
cover the places Svelte's generated code reads nodes directly.

The renderer itself is stateless; each node carries its render context
(`node.ctx`), attached on insert and cleared on remove, so trees can be
built detached and adopted later.

## The pipeline

Each frame runs a browser-shaped pipeline against the `TermNode` tree,
with one radical simplification: the unit of geometry is a character
cell, not a pixel.

```
component source
      │ svelte compiler (customRenderer)
      ▼
  TermNode tree  ◄── Svelte reactivity mutates it
      │ resolve styles      cascade, specificity, selectors, var(), @media
      ▼
  ResolvedStyle per node
      │ layout              block/inline flow, flex, grid, tables → cells
      ▼
  LayoutBox per node        { x, y, width, height } in cells
      │ paint               borders, text, backgrounds, form glyphs
      ▼
  CellBuffer                every cell: { char, fg, bg, bold, … }
      │ diff vs previous buffer
      ▼
  minimal ANSI              cursor moves + SGR codes, sync-wrapped
```

- **Style resolution** matches the stylesheet's selectors against the
  tree and folds the cascade into one `ResolvedStyle` struct per element
  — the same job as a browser's computed style, minus pixel-derived
  properties (which parse and drop; see
  [compatibility](./compatibility.md)).
- **Layout** implements block/inline flow, flexbox, grid, and table
  algorithms over integer cells. Every length rounds to whole cells;
  borders are one cell thick.
- **Paint** writes glyphs and colours into a `CellBuffer` — including
  box-drawing borders, list markers, form-control glyphs like `[x]`, and
  `::before`/`::after` runs.
- **Diff** compares against the previous buffer and emits only the
  changed cells as ANSI (cursor positioning + colour codes), wrapped in
  a synchronized-update sequence so the terminal repaints atomically.

## Incremental updates

Re-running the whole pipeline per keystroke would waste most of its
work, so mutations are classified at the point Svelte makes them:

- same-length text change → **paint only**
- attribute change → **re-resolve styles** for the node and its
  descendants (any attribute can affect selector matching)
- size-affecting change → **layout**, scoped to a subtree or bubbled to
  the nearest fixed-size ancestor

A microtask-batched queue coalesces a burst of mutations into one
render, which runs only the stages the batch needs — an incremental
style pass, an incremental layout pass, and a repaint clipped to the
damaged region.

## Input, without a browser

Raw stdin bytes are parsed into key events (including modifiers and
escape sequences), SGR mouse events with cell coordinates, and
bracketed paste. Mouse positions hit-test against the layout boxes to
find the target node; events then dispatch through the tree with
W3C capture/bubble semantics, `preventDefault()` and all. Focus is a
document-order traversal of focusable elements driven by `Tab`, with
`:focus`/`:hover` implemented as attribute-backed pseudo-classes.
Default actions (link opening, checkbox toggling, select cycling,
label activation) live in the run loop, mirroring browser behaviour.

## Time

An animation clock discovers elements whose resolved style declares an
animation or whose transition targets changed, applies the current
interpolated values onto their resolved styles (~30fps), and enqueues
paint-only or layout invalidation per frame depending on what the
animation touches — see [motion](./motion.md).

## The terminal is an interface too

All output goes through a small `TerminalIO` interface rather than
`process.stdout` directly. `ProcessIO` backs real terminals (raw mode,
alternate screen, resize signals, OSC 11 colour-scheme queries);
`InProcessIO` backs anything that can accept a byte stream — which is
how the playground works: the same engine, compiled for the browser,
writes its ANSI into an xterm.js instance. The browser pane next to it
is simply the same component compiled with Svelte's normal DOM renderer.
One source, two render targets — that contrast is the whole point.
