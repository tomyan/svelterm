# Roadmap 2: correctness, scale, ecosystem

Follow-on from PLAN-ROADMAP.md (all arcs shipped as 0.2.0–0.10.0).
Ordered by the argument made 2026-07-04: correctness debt first, then
robustness evidence, then scale, then ecosystem. Same release checklist
as PLAN-ROADMAP.md applies to every arc (tests, docs, changelog, tag,
GitHub release, npm attempt, site deploy queue).

All arcs completed 2026-07-04 (v0.11.0–v0.17.0 for @svelterm/core,
@svelterm/ui 0.1.0). Debug tooling shipped as 0.17.0 (0.16.0 was a
bundler fix). Kitty graphics deferred to Later (see Arc 5 note).

## Arc 1 — Unicode correctness (0.11.0)

Text layout assumes 1 char = 1 cell. CJK is 2 cells wide; emoji are
multi-code-unit graphemes; combining marks are 0. Today `你好` measures
2 but renders 4, corrupting borders, wrapping, and diffs.

- [x] Slice 1: width primitives — grapheme segmentation
      (Intl.Segmenter) + East Asian Width tables: `graphemes(str)`,
      `charWidth(grapheme)`, `stringWidth(str)`. No dependencies.
- [x] Slice 2: measurement — wrapText / measureText / truncateText /
      truncateMiddle operate on graphemes and cell widths.
- [x] Slice 3: buffer + paint — wide glyphs occupy two cells (glyph +
      continuation); diff/InlineScreen emit the glyph once and skip the
      continuation; partial overwrites blank the orphaned half.
- [x] Slice 4: input — TextBuffer cursor moves by grapheme; cursor
      screen x accounts for widths; selection extraction likewise.
- [x] Verify in tmux with a CJK + emoji demo; docs note in
      terminal-css.md (text) + reference.

## Arc 2 — Terminal matrix evidence (0.12.0)

All verification so far is Ghostty/tmux on macOS.

- [x] Slice 1: PTY smoke suite — run demos against @svelterm/vt100 via
      InProcessIO asserting rendered frames (screenshot-style tests that
      run in CI, no real terminal needed).
- [x] Slice 2: degraded-terminal runs — TERM=xterm (16-colour),
      TERM=screen, NO_COLOR through the same harness; assert quantized
      output parses back correctly.
- [x] Slice 3: manual matrix table in docs/terminals.md (Ghostty, tmux,
      Terminal.app, iTerm2, kitty, WezTerm, Windows Terminal — tested /
      expected / unknown) with honest "unknown" cells.

## Arc 3 — Virtual scrolling (0.13.0)

Long lists (logs, file trees) currently lay out and paint entirely.

- [x] Slice 1: paint culling — skip painting subtrees fully outside the
      effective clip (correct for all content, no API).
- [x] Slice 2: layout windowing for scrollable containers — reuse cached
      child layout for children outside the viewport when only scroll
      position changed (scroll becomes O(visible)).
- [x] Slice 3: bench — a 10k-row list demo with scroll latency numbers
      in the changelog.

## Arc 4 — Inline-mode maturity (0.14.0)

- [x] Slice 1: origin tracking — CPR (CSI 6n) query at first render plus
      scroll accounting on bottom-row LFs → mouse support in inline mode
      (hit testing maps screen → zone coordinates).
- [x] Slice 2: site playground example for inline mode + run-real
      endpoint (rides the queued site deploy).

## Arc 5 — Images (0.15.0)

- [x] Slice 1: `<img>` via half-block cells (▀ fg/bg = two vertical
      pixels per cell) from raw RGBA (`src` as data: URI or a pixel-
      buffer prop; PNG decode via optional dependency).
- [x] Slice 2: kitty graphics protocol where detected (capability query
      already plumbed); half-block fallback elsewhere.
      *2026-07-04: deferred to Later — transmission/placement lifecycle
      (ids, deletion on repaint, scroll interaction) is a large surface
      for one terminal family; half-block works everywhere and ships in
      0.15.0.*

## Arc 6 — @svelterm/ui 0.1.0

Component library distributed as .svelte source (consumers compile with
their renderer setup, like any svelte lib): dialog, selectable list,
tabs, fuzzy picker, toast — dogfooding the engine. Colour picker exists.

## Arc 7 — Debug tooling (0.16.0)

DOM + CSS domains on the existing WebSocket server; `svt` CLI (connect,
query, print). DevTools TUI stays out of scope until @svelterm/ui lands.

## Standing blockers (user)

- npm publishes 0.2.0+ need an interactive OTP per publish.
- Site deploys need `aws sso login --profile tyanroot`.
