# Why CSS for terminals

> **DRAFT for Tom to rework** (2026-07-07). Claims are technical and
> checked against the codebase at 0.32.0. Voice is deliberately flat —
> rewrite freely. `[TOM: …]` marks places that want a personal angle
> only you can supply.

Terminal UIs are having a good few years. Developer tools live in the
terminal again, LLM agents run there, and the ecosystem of TUI
frameworks has grown to match. But almost every framework solves layout
the same way: invent one. A widget tree with bespoke sizing rules, a
constraint system, a flexbox-inspired-but-not-flexbox model — each one
a new dialect you learn for exactly one library, each one rediscovering
the hard cases (margin collapsing, min-content sizing, wrapping) one
bug report at a time.

svelterm makes a different bet: the layout language you already know is
the right one. You write Svelte components with HTML semantics and
style them with CSS — actual CSS, parsed and cascaded and resolved —
and the renderer paints them onto a terminal cell grid.

```svelte
<div class="app">
    <span class="title">Files</span>
    <input value="" oninput={filter} />
    <div class="listing">…</div>
</div>

<style>
    .app { display: flex; flex-direction: column; gap: 1cell; }
    .listing { border: single; overflow: scroll; flex-grow: 1; }
    .title { font-weight: bold; color: cyan; }
</style>
```

`[TOM: why you started this — the itch, the moment. Nothing below
supplies motive; only this paragraph can.]`

## The case for CSS

**You already know it.** Every TUI framework asks you to learn its
layout dialect. CSS is the one layout language with tens of millions of
fluent speakers. `display: flex; gap: 1cell` needs no documentation.

**It's a real specification.** Flexbox alone answers questions bespoke
systems usually haven't asked yet: what happens when content overflows
a fixed container (flex-shrink, §9.7 resolution, auto minimum sizes),
how auto margins interact with justification, what a percentage
resolves against. When svelterm's flex items didn't shrink below their
content height, the fix wasn't a design debate — the spec already said
what should happen, down to the redistribution rule when a clamped item
can't absorb its share.

**Styling is separate from structure.** Components carry semantics;
themes carry appearance. `@media (prefers-color-scheme: dark)`,
`light-dark()`, and custom properties work in a terminal exactly the
way they work in a browser — svelterm polls the terminal's background
via OSC 11 and re-resolves the cascade when it changes. A component
library can ship on design tokens without owning anyone's palette.

**Cells are just a coarse viewport.** CSS never promised pixels; it
promised boxes in a coordinate system. A terminal is a 80×24-ish grid
of em-square cells — unusually chunky, but a perfectly legal medium.
The `ch` unit maps to exactly one cell, which has a pleasant
consequence: a stylesheet written in `ch` units lays out the same
component in the browser and the terminal.

## What a terminal renderer actually is

svelterm is a custom Svelte 5 renderer. Svelte's compiler, pointed at a
renderer instead of the DOM, emits the same fine-grained reactive
template code — but element operations land on svelterm's `TermNode`
tree instead of DOM nodes. From there the pipeline is a small browser:

1. **CSS resolution** — a stylesheet parser and cascade with
   selectors (combinators, `:nth-child`, `:focus`, attribute
   selectors, `:where()`/`:is()`), specificity, inheritance, custom
   properties, `calc()`, and media queries against the terminal's
   size and colour scheme.
2. **Layout** — block and inline flow with a real inline formatting
   context (text runs gather across inline element boundaries and wrap
   like browser text), flexbox, grid, tables, absolute/fixed/sticky
   positioning, overflow with scroll state.
3. **Paint** — layout boxes become styled cells in a `CellBuffer`:
   borders as box-drawing glyphs, backgrounds and foregrounds as
   colours quantized to the terminal's depth (truecolor → 256 → 16 →
   mono), bold/italic/underline/dim as text attributes.
4. **Diff and emit** — successive buffers diff to a minimal ANSI
   update, wrapped in synchronized-output markers so frames never
   tear.

Each stage is incremental. A render queue tracks what a mutation
actually invalidated — paint-only, style re-resolution, subtree layout,
or a full pass — so a caret blink doesn't re-lay-out the world.

Input runs the pipeline in reverse: byte-level parsers for keys (kitty
protocol included) and SGR mouse events feed a focus system, a
readline-grade editing model (kill ring, undo, word ops, selection —
in both `input` and multiline `textarea`), and W3C-style
capture/bubble event dispatch. If you can write an `onclick` in a
browser, you can write one here, and `preventDefault()` means what it
always means.

## Where the metaphor bends

Honesty section: a terminal is not a browser, and pretending otherwise
produces worse terminal apps, not better web apps.

- **Units are whole cells.** Everything rounds; `4.6ch` is five cells.
  Layout code carries the rounding rules the way browsers carry
  subpixel rules.
- **Borders are characters.** `border: single | double | rounded |
  heavy | ascii` names glyph sets, not stroke widths. Adjacent borders
  can collapse into shared glyph runs, which is a terminal-only
  aesthetic decision CSS never had to make.
- **Colour is a palette negotiation.** Named ANSI colours (all
  sixteen) stay palette-relative so themes follow the user's terminal;
  hex stays truecolor and quantizes down where it must.
- **Some CSS has no sensible mapping** — floats, transforms,
  fractional opacity beyond a dim approximation — and svelterm skips
  them rather than faking them badly.

The surprising part is how little bends. The 6×6×6 colour cube, flex
shrink semantics, `white-space: pre`, `text-overflow: ellipsis`,
sticky headers, CSS animations with easing — all of it has a natural
cell-grid reading.

## Testing like it's a real platform

A UI framework is only as trustworthy as its test story. svelterm
renders headlessly (component → cell buffer, no terminal), and ships a
scenario harness that drives a *real running app* over its debug
socket: inject key and mouse events as the bytes a terminal would send
(so the parsers stay in the tested path), wait for the render loop to
settle, and assert on the emulated screen — down to individual cell
attributes. The demos in the repo are each built against that harness;
the editor demo's test types into a real process, saves, and asserts
the file on disk.

`[TOM: optionally, the sumi angle — svelterm has a Go sibling that
shares editing/layout semantics, and the two implementations
cross-check each other. Your call whether that story belongs here or
in its own post.]`

## Try it

```bash
npm i @svelterm/core
npx svelterm init my-app      # scaffold a project
```

The repo ships demos you can run in a minute each: a file browser, a
markdown viewer, a colour palette, a plain-text editor, a two-pane
terminal multiplexer on real ptys, and a dual-target component that
runs unchanged in the terminal and the browser.

`[TOM: closing — where this is going, what you want from readers
(issues? components? terminals to test?).]`
