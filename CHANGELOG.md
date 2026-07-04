# Changelog

## 0.19.0 — 2026-07-05

Kitty graphics: crisp `<img>` pixels where the terminal supports them.

### Added

- **Kitty graphics protocol** — on kitty, Ghostty, and WezTerm (detected
  via XTVERSION), `<img>` transmits real RGBA pixels scaled to its cell
  box instead of half-blocks. Pixel data transmits once per (element,
  src); each frame re-places over the box and deletes placements for
  images that moved, scrolled away, or unmounted; teardown and suspend
  clear them. Half-blocks stay the buffer fallback everywhere else.

## 0.18.0 — 2026-07-04

Scroll-region diffing, and a border-clip fix found along the way.

### Added

- **DECSTBM scroll diffing** — when a repaint is a clean vertical
  translation of the previous frame (a full-viewport scroll), the diff
  emits a scroll-region command + index/reverse-index and paints only
  the newly revealed rows, instead of rewriting the screen. ~13× less
  output on an 80×40 one-line scroll (`scripts/bench-scroll-bytes.mjs`).
  Falls back to the normal cell diff for any non-translation change.

### Fixed

- **Scrolled content painted over borders** — a bordered
  `overflow: auto`/`scroll` box clipped its children to the box
  *including* the border cells, so scrolled content overwrote the top
  and bottom border rows. The clip now insets by the border. (Regression
  from 0.13.0's virtual scrolling.)

## 0.17.0 — 2026-07-04

Debug tooling: a minimal DevTools for terminal apps.

### Added

- **DOM and CSS debug domains** — over the existing (opt-in) debug
  WebSocket server: `DOM.getDocument` serialises the live node tree,
  `DOM.querySelector` finds nodes by selector, `DOM.getBoxModel` reports
  layout, `DOM.setAttribute`/`removeAttribute` mutate and repaint;
  `CSS.getComputedStyle` returns the resolved style svelterm painted.
- **`svt` CLI** (`svelterm inspect`) — a client for the protocol:
  `svt tree | query <sel> | style <id> | box <id> | console | raw`,
  JSON on stdout for `jq`. Point it at a `run(App, { debug: true })`
  app.

## 0.16.0 — 2026-07-04

### Fixed

- **`svelterm build` with symlinked component libraries** — a library
  installed via `file:`/`link:` (e.g. a local `@svelterm/ui`) resolves
  its imports from its real path, where the app's `node_modules` isn't
  visible, so `@svelterm/core` and `svelte` failed to resolve. The
  bundler now pins those packages to the project's own installation.

## 0.15.0 — 2026-07-04

Images: `<img>` on the cell grid.

### Added

- **`<img>`** — renders as half-blocks (two pixels per cell) from file
  paths or `data:image/png;base64` URIs. PNG decoding (8-bit
  RGB/RGBA/greyscale/palette) is built in with no dependencies, via
  `node:zlib`. Intrinsic size is 1 column per pixel and 1 row per two;
  CSS `width`/`height` scale nearest-neighbour. Loading is async — the
  layout reflows when pixels arrive; transparent pixels show the
  terminal background. (Kitty graphics passthrough is deliberately not
  included yet — half-blocks work everywhere.)

## 0.14.0 — 2026-07-04

Inline-mode maturity: the mouse works in the live area.

### Added

- **Inline-mode mouse** — the zone's screen origin comes from a CPR
  (cursor position report) query, snapshotted as the query bytes go out,
  shifted as frames archive, and clamped when growth scrolls the zone.
  Mouse coordinates map through it; clicks on shell history are ignored.
  Origins re-query after resize and suspend/resume.
- **Playground example** — `inline mode` example with a `svelterm:inline`
  marker that the site preview and the `run/*.mjs` bundles honour.

### Fixed

- An explicit `mode` now wins over the `fullscreen` flag —
  `mode: 'fullscreen', fullscreen: false` is full-viewport rendering
  without the alternate screen again (embedded previews), instead of
  being forced inline.

## 0.13.0 — 2026-07-04

Virtual scrolling: long lists repaint at the speed of what's visible.

### Changed

- **Paint culling** — subtrees fully outside the active clip are skipped
  in the paint walk (cell writes were already clipped, so output is
  identical). A 10,000-row `overflow: scroll` list drops from ~228 ms to
  ~1.4 ms per scroll repaint on the benchmark machine
  (`scripts/bench-scroll.mjs`); first paint from ~254 ms to ~5 ms.
- **Scrollbar extent caching** — the content-size walk behind scrollbar
  overlays is memoized per layout, instead of re-walking every child on
  every frame of the fade.

### Fixed

- A focused input culled offscreen no longer reports a stale cursor
  position — cursor positions carry the paint generation that wrote
  them, and the terminal cursor hides when its owner leaves the
  viewport.

## 0.12.0 — 2026-07-04

Terminal matrix evidence: proof the emitted bytes work, per terminal
class.

### Added

- **Round-trip test suite** — svelterm's emitted ANSI (full frames,
  incremental diffs, the inline live zone) replays through a terminal
  model in CI and must reproduce the exact cell grid, at every colour
  depth (truecolor / 256 / 16 / mono) and with wide glyphs.
- **Support matrix** in `docs/terminals.md` — verified vs expected vs
  unknown, per terminal, with the capability columns that matter
  (truecolor, DEC 2026, kitty keys, OSC 52).

## 0.11.0 — 2026-07-04

Unicode correctness: non-Latin text stops breaking layout.

### Fixed

- **Cell widths** — text measurement previously assumed one JavaScript
  character = one terminal cell, so CJK, fullwidth forms, and emoji
  misaligned borders, wrapping, and diffs. Layout, paint, truncation,
  and the inline renderer now work in grapheme clusters with East Asian
  Width cell widths; wide glyphs own a continuation cell that diff
  emission skips.
- **Input editing** — cursor movement, backspace, and delete operate on
  grapheme boundaries (arrow keys no longer split surrogate pairs or ZWJ
  emoji); the terminal cursor position accounts for wide glyphs.

## 0.10.0 — 2026-07-04

Colour blending: real alpha compositing on the cell grid.

### Added

- **Alpha colours** — `rgba()`, `hsl(... / a)`, `#rrggbbaa` keep their
  alpha and composite over whatever the cell already holds at paint
  time. Blending over ANSI names uses nominal xterm values; over the
  terminal's default background it assumes black.
- **Numeric `opacity`** — folds into the element's colours as a blend
  factor (previously any `opacity < 1` just set the dim attribute; the
  non-standard `opacity: dim` still does).

## 0.9.0 — 2026-07-04

Text & content: wrapping control, path-friendly truncation, and raw
ANSI passthrough.

### Added

- **`word-break: break-all`** — wrap at any character (URLs, hashes,
  paths) instead of only at spaces; inherits as in CSS and applies in
  both layout and paint.
- **`text-overflow: ellipsis-middle`** — the parsed-but-unwired middle
  truncation now paints: `/Users/tom/…/index.ts` style, keeping both
  ends of long paths.
- **`<svt-ansi>`** — raw ANSI passthrough element: pre-styled output
  (git diff, ls --color, build logs) renders with its own SGR colours
  (16/256/truecolor + attributes); non-SGR sequences are stripped,
  content is `pre`-formatted.

## 0.8.0 — 2026-07-04

Input completeness: modern key reporting, honest job control, and
browser-style modals.

### Added

- **Kitty keyboard protocol** — CSI u key reports parse with correct
  modifiers (`Ctrl+Enter`, `Shift+Space`, …); the protocol is pushed at
  startup and popped on exit and suspend. Terminals without it ignore
  the push and keep the legacy encoding.
- **Suspend/resume** — `Ctrl+Z` restores the terminal for the shell
  without unmounting; `fg` (SIGCONT) re-enters raw mode, alt screen,
  mouse and keyboard modes, and repaints with component state intact.
  Previously Ctrl+Z tore the app down.
- **`exitOn` option** — opt into `Ctrl+D` EOF-style exit
  (`run(App, { exitOn: ['ctrl+c', 'ctrl+d'] })`).
- **Modal `<dialog open>`** — captures keys: Tab/Shift+Tab trap inside
  the dialog, focus pulls in from outside, Escape removes `open` and
  dispatches `close`.

### Fixed

- Legacy CSI modifier parsing was off by one — `Shift+Arrow` reported
  as Alt, `Ctrl+Arrow` as Shift+Alt.

## 0.7.0 — 2026-07-04

Inline rendering: svelterm apps that live in the main buffer like a
CLI tool, not a fullscreen TUI.

### Added

- **`mode: 'inline'`** — render at the shell cursor: the live area sizes
  to content, updates via cell diffs with relative-only cursor movement
  (LF to grow, erase-below to shrink), and leaves its output in place on
  exit. `fullscreen: false` now routes here too. Mouse reporting is off
  in inline mode (screen-absolute coordinates can't map to an unknown
  origin); keyboard, focus, and the input cursor work as usual.
- **`FrameLog`** — append-only frame log for streaming sessions:
  `append(Component, props)` / `update` / `archive` / `remove`.
  Archived frames' rows scroll into the terminal's real history
  untouched and their components unmount, so a long session's memory
  tracks the live area, not the transcript. See `docs/inline-mode.md`.
- **`demo/inline`** — five streaming turns, each archived into
  scrollback (`DEMO=inline npm run demo`).

## 0.6.0 — 2026-07-04

Terminal integration: selection, clipboard, and a cursor that reads as
an insertion point.

### Added

- **Text selection** — drag selects a row-major cell range (painted
  inverted), double-click selects the word, triple-click the line.
  Releasing copies the selection; the next click clears it. Works over
  the diff pipeline without repainting the tree.
- **Clipboard** — selections copy via OSC 52 (in-band, ssh-safe) plus
  the platform tool (`pbcopy`, `wl-copy`/`xclip`, `clip`) when present;
  `copyToClipboard` is exported for apps.
- **Cursor shape** — a focused `<input>`/`<textarea>` shows a bar cursor
  (DECSCUSR 6); the terminal's configured shape is restored otherwise
  and on exit.

## 0.5.0 — 2026-07-04

Terminal robustness: the same app now degrades gracefully from a
truecolor GPU terminal down to `TERM=xterm` — and respects `NO_COLOR`.

### Added

- **Capability detection** — colour depth from
  `NO_COLOR`/`COLORTERM`/`TERM`, plus an XTVERSION query identifying
  known-truecolor terminals; DEC 2026 synchronized-output support probed
  via DECRQM. Detection runs in the background with timeouts; the first
  frame paints with modern defaults and re-paints on a downgrade.
- **Colour degradation** — hex/RGB colours quantize at emit time: xterm
  256 cube/grey-ramp on 256-colour terminals, nearest base colour on
  16-colour terminals, no colour under `NO_COLOR`. ANSI names always
  pass through. Override with `run(App, { colorDepth })`.
- **Gated synchronized output** — frames wrap in DEC 2026 only when the
  terminal reports the mode (previously sent unconditionally).
- **`docs/terminals.md`** — what svelterm emits and queries, per depth.

## 0.4.0 — 2026-07-04

The developer-experience release: `npx @svelterm/core init` to a running,
hot-reloading, shippable app in one minute.

### Added

- **`svelterm init <dir>`** — scaffold a working project: counter
  component, vite config, dev/app/build scripts, fork-setup README.
- **`svelterm build [entry]`** — bundle the component graph, Svelte
  runtime and svelterm into one self-contained `.mjs` (rolldown, node
  platform) that runs with plain `node`. Global CSS via `--css` or
  `src/main.css` convention; component CSS travels in the bundle through
  the new `registerComponentCss` registry that `run()` falls back to.
- **Terminal-environment `.svelte` compilation** — `terminalServer()`
  compiles components for the terminal environment itself, so
  terminal-only projects need no `vite-plugin-svelte` (the registry
  plugin is not environment-aware and emitted empty component stubs for
  custom environments, rendering a blank screen).
- **Console forwarding in dev** — `console.log` from the app streams to
  the vite terminal prefixed `[svelterm]`; previously any console call
  crashed `svelterm dev`.

### Changed

- The `svelterm` bin now dispatches `init` / `dev` / `build`
  subcommands (previously `dev` only).
- The terminal environment marks `svelte` and `@svelterm/core` as
  `noExternal` so a natively-imported second copy can't split module
  state.

## 0.3.0 — 2026-07-04

Motion completeness: easing everywhere, and keyframes that understand
your theme.

### Added

- **Easing functions** — `animation-timing-function` and
  `transition-timing-function` (longhands and inside the shorthands)
  support `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`,
  `cubic-bezier()`, `steps(n[, start|end])`, `step-start` and `step-end`.
  Easing applies per keyframe segment; non-interpolable values switch when
  eased progress crosses the midpoint, as in CSS.
- **Keyframe `var()` / `light-dark()`** — keyframe declarations resolve
  custom properties and colour-scheme pairs against the animated element
  when the animation starts.

### Changed

- Timing functions default to `ease` per spec (previously everything
  interpolated linearly). Declare `linear` explicitly to keep the old
  behaviour.

## 0.2.0 — 2026-07-04

The browser-compatibility release: any HTML/CSS feature with a sensible
cell-grid meaning now works as a browser author expects. Full support matrix
in [`docs/reference.md`](docs/reference.md); manual in [`docs/`](docs/).

**Requires** a Svelte fork with the custom renderer API. Until
[sveltejs/svelte#18505](https://github.com/sveltejs/svelte/pull/18505) lands,
use [`tomyan/svelte#svelte-custom-renderer`](https://github.com/tomyan/svelte/tree/svelte-custom-renderer)
(upstream plus the `svelte/renderer` mount export svelterm needs on Node).

### Added

- **CSS grid** — column and row templates with `fr`/`repeat()`/`minmax()`,
  `grid-column`/`grid-row` placement and spans, `grid-template-areas` with
  named `grid-area`
- **CSS tables** — `display: table*` including `inline-table`, sections and
  captions, `colspan`/`rowspan`, `vertical-align`, `border-collapse` with
  shared box-drawing grid lines, anonymous table boxes
- **Animations & transitions** — `@keyframes` wired into the render loop
  with RGB colour interpolation between stops, cell-stepped length
  animation, discrete stepping for other properties; `transition` on style
  changes
- **Selectors** — attribute operators (`^=`, `$=`, `*=`, `~=`, `|=`),
  `:is()`/`:where()`, the `:nth-child()` family, structural pseudo-classes
  (`:empty`, `:first/last/only-of-type`, `:only-child`),
  `:checked`/`:disabled`/`:enabled`, `::before`/`::after` with `content`
- **Form controls** — checkboxes and radios, cycling `<select>`,
  `<progress>`/`<meter>` block-glyph bars, `<details>`/`<summary>`,
  labels activate their controls on click
- **CSS values** — Color Level 4 syntax, `light-dark()`, inline `style`
  attributes, `box-sizing`, `text-transform`, the `ch` unit as a `cell`
  alias
- **Scrolling** — viewport scrolling with overlay scrollbars, horizontal
  scroll, scroll clamping on resize
- **Borders** — block-character border styles with half-cell corner
  treatment
- **IO abstraction** — `ProcessIO` (with `/dev/tty` fallback when stdin is
  piped) and `InProcessIO` for embedding; browser-compatible input parsing
- **Dev mode** — `svelterm dev` CLI with Vite environments, HMR, and a
  two-process WebSocket bridge
- **Docs** — chaptered manual under `docs/` and a full feature support
  matrix with MDN links in `docs/reference.md`

### Changed

- Tracks the upstream unified `mount({ renderer, target, props })` API from
  the `svelte-custom-renderer` branch
- Exact hex/computed colours are no longer remapped to nearest ANSI names
- Flex `align-items: stretch` no longer overrides an explicit cross-axis
  size

### Fixed

- Incremental repaint artifacts (borders, list markers), flex `min-height:
  auto` shrinking per spec, nested `@media` inside selector blocks, inline
  whitespace and list bullets, scroll position clamping after relayout

## 0.1.0

Initial release — name reservation and early preview.

**Requires** the unmerged [`svelte-custom-renderer`](https://github.com/paoloricciuti/svelte/tree/svelte-custom-renderer) branch of Svelte 5.

### Features

- **CSS engine** — selectors, specificity, cascade, inheritance, scoped styles, `var()`, `calc()`, `@media`, `@keyframes`, `:focus`, `:hover`
- **Flexbox layout** — `flex-direction`, `justify-content`, `align-items`, `flex-grow`, `flex-shrink`, `flex-basis`, `gap`, `flex-wrap`, `order`
- **Terminal rendering** — ANSI colors (16, 256, truecolor), box-drawing borders (`single`, `double`, `rounded`, `heavy`), text styles, differential output
- **Incremental updates** — mutations classified as paint-only, style-resolve, layout-subtree, or layout-bubble to avoid full recomputation
- **Input handling** — keyboard events, mouse (click, scroll, motion), focus management with Tab/Shift+Tab, bracketed paste
- **Text input** — `<input>` and `<textarea>` with readline-like editing
- **Color scheme detection** — automatic `prefers-color-scheme` via OSC 11 terminal query
- **Debug protocol** — WebSocket-based CDP-inspired server with Console domain
- **Dual-target components** — same `.svelte` component renders in terminal and browser via `@media (display-mode: terminal/screen)`
