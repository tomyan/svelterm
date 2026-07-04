# Changelog

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
