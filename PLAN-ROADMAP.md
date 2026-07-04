# Roadmap: remaining features

Ordered execution plan for the gaps identified after the browser-compat arc
(2026-07-04). Each arc is a set of thin slices (red → green → refactor), and
**every arc ends with the same release checklist**:

## Release checklist (every arc)

1. Full test suite green (`npm test` unit + integration).
2. Docs updated: relevant `docs/*.md` chapter + `docs/reference.md` matrix
   (the site pulls these at build time).
3. `CHANGELOG.md` — new section, keepachangelog style.
4. Version bump in `package.json` (minor per arc).
5. Commit, tag `vX.Y.Z`, push with tags.
6. GitHub release via `gh release create` with the changelog section as notes.
7. `npm publish` — if auth is expired (E401), record the pending version in
   the "npm publish backlog" section below and continue; catch up when the
   user has run `npm login`.
8. Site deploy when docs changed: rebuild svelterm-site, `tofu plan` →
   review → `tofu apply <planfile>` (never `-auto-approve`). If AWS SSO is
   expired, queue it and continue.

## npm publish backlog

npm publishing is blocked on credentials: 0.1.0 was published locally (no
provenance) and the repo has no `NPM_TOKEN` Actions secret, so the
release-triggered publish workflow has never succeeded. To unblock, either
run `npm login` locally, or add an `NPM_TOKEN` secret (or configure npm
trusted publishing for tomyan/svelterm) and re-run the failed publish jobs.

- @svelterm/core 0.2.0 (tag v0.2.0)
- @svelterm/core 0.3.0 (tag v0.3.0)
- @svelterm/core 0.4.0 (tag v0.4.0)
- @svelterm/core 0.5.0 (tag v0.5.0)
- @svelterm/core 0.6.0 (tag v0.6.0)
- @svelterm/core 0.7.0 (tag v0.7.0)
- @svelterm/core 0.8.0 (tag v0.8.0)
- @svelterm/core 0.9.0 (tag v0.9.0)
- @svelterm/core 0.10.0 (tag v0.10.0)

Also queued behind AWS SSO: a playground example for inline mode
(browser preview + run-real endpoint) — repo demo shipped as
`demo/inline`; the site example needs a site rebuild/deploy.

Local `npm login` succeeded (2026-07-04) but each publish still demands an
interactive OTP; run `npm publish --access public --otp=<code>` per pending
version, oldest first — npm requires ascending order? (it doesn't; any
order works, but publish 0.3.0 last so `latest` points at it).

## Site deploy queue

Deploys pending AWS SSO login (`aws sso login --profile tyanroot`):

- svelterm-site rebuild with ALL 0.3.0–0.10.0 docs including the two new
  chapters (terminals, inline-mode; routes committed and site built
  2026-07-04). To ship: `aws sso login --profile tyanroot`, then in
  svelterm-site/infra: `tofu plan -out=x.tfplan` → review → apply.

All arcs below completed 2026-07-04 (v0.2.0 … v0.10.0). Remaining
work lives under “Later”.

## Arc 0 — Release 0.2.0: everything shipped to date

The npm package is stale at 0.1.0; the repo has since gained the full
browser-compat arc, animations/transitions, grid, tables, forms, docs.

- [x] Create `CHANGELOG.md` retroactively: 0.1.0 summary + 0.2.0 section
      covering browser compat, grid, tables, animations, docs.
- [x] Verify package contents (`npm pack --dry-run`) include dist + docs refs.
- [x] Release checklist.

## Arc 1 — Motion completeness (0.3.0)

Close the documented deviations in the animation system.

- [x] Slice 1: easing functions — `linear`, `ease`, `ease-in`, `ease-out`,
      `ease-in-out`, `cubic-bezier(...)` applied to keyframe segment progress
      and transitions. `steps(n, position)` for discrete stepping.
- [x] Slice 2: keyframe declarations resolve `var()` and `light-dark()`
      against the animating element's computed custom properties/scheme.
- [x] Docs: `docs/motion.md` deviations table shrinks accordingly.

## Arc 2 — Developer experience (0.4.0)

Make `npx svelterm` the happy path; kill the manual vite config in README.

- [x] Slice 1: verify/fix existing `svelterm dev` + `src/vite/config.ts`
      against the current fork (HMR, CSS collection, error reporting).
- [x] Slice 2: `svelterm build` — produce a self-contained mjs bundle
      (reuse the site's build-demos approach: rolldown, node platform,
      ws stubbed).
- [x] Slice 3: `svelterm init` — scaffold vite.config + App.svelte + main.css
      into an empty directory.
- [x] Docs: rewrite `docs/getting-started.md` around the CLI; update README
      Setup section.

## Arc 3 — Terminal robustness (0.5.0)

"Works on my machine" insurance for varied terminals.

- [x] Slice 1: capability detection — DA1/DA2 + XTVERSION queries at startup
      (with timeout fallback), exposed as a capabilities object.
- [x] Slice 2: colour degradation — truecolor → 256 → 16 quantization applied
      at ANSI-emit time based on detected capabilities; overridable via env
      (`COLORTERM`, `NO_COLOR`, explicit option).
- [x] Slice 3: synchronized output — wrap frames in DEC 2026 BSU/ESU when
      the terminal supports it.
- [x] Docs: new `docs/terminals.md` (support matrix by terminal emulator).

## Arc 4 — Terminal integration (0.6.0)

- [x] Slice 1: cursor shape control (DECSCUSR) — block/underline/bar tied to
      focused editable state.
- [x] Slice 2: clipboard — OSC 52 write on copy; platform fallbacks
      (pbcopy/xclip/wl-copy) behind the IO abstraction.
- [x] Slice 3: text selection — mouse drag selects cells, double-click word,
      triple-click line; copies via slice 2.
- [x] Docs: `docs/elements.md` + reference updates.

## Arc 5 — Inline rendering mode (0.7.0)

Per `DESIGN-inline-mode.md`: non-alt-screen streaming apps (Claude-Code-like
CLIs). Largest new audience.

- [x] Slice 1: inline viewport — render at cursor position, height = content,
      relative cursor movement diffing, no alt screen.
- [x] Slice 2: archive zone — `<framelog>` element whose completed entries are
      printed into scrollback and dropped from the live tree.
- [x] Slice 3: resize + reflow of the live zone; scrollback stays untouched.
- [x] Slice 4: demo (streaming log + input prompt) + run-real endpoint.
- [x] Docs: `docs/inline-mode.md`.

## Arc 6 — Input completeness (0.8.0)

- [x] Slice 1: kitty keyboard protocol (CSI u) — detect, enable, parse;
      fixes key-release/modifier gaps where supported.
- [x] Slice 2: Ctrl+Z suspend (restore terminal, SIGTSTP, reinit on SIGCONT);
      configurable Ctrl+D.
- [x] Slice 3: priority-based key routing — modal layers capture keys before
      focus routing (`<dialog>` integration).
- [x] Docs: `docs/elements.md` input section.

## Arc 7 — Text & content (0.9.0)

- [x] Slice 1: `word-break` / `overflow-wrap` control; `text-overflow`
      middle-truncation extension.
- [x] Slice 2: raw ANSI passthrough element (`<pre data-ansi>` or similar)
      rendering pre-styled content via the vt100 parser.
- [x] Docs: `docs/terminal-css.md` text section.

## Arc 8 — Colour blending (0.10.0)

- [x] Slice 1: alpha compositing — `rgba()`/`#rrggbbaa` backgrounds blend
      over the cell beneath during paint.
- [x] Slice 2: `opacity: <number>` as blend factor (in addition to `dim`).
- [x] Docs: `docs/terminal-css.md` colour section.

## Later (not in this run's scope unless reached)

- Virtual scrolling, DECSTBM scroll regions.
- Images (half-block, sixel, kitty graphics).
- Debug protocol domains + `svt` CLI + DevTools TUI.
- @svelterm/ui components (dialog, list, tabs, fuzzy picker, embedded
  terminal pane) and remaining demos (file browser, svmux, dual-target).

## Validation between arcs

After each arc: re-run the full suite, run at least one demo in a real
terminal via tmux, and reassess whether the next arc is still the most
valuable — record any reordering here with a dated note.
