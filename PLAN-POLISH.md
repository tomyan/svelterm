# Polish list

**Executed 2026-07-05.** Items 1,2,3 shipped in the site (commit, deploy
queued); items 5,6,7 shipped as @svelterm/core 0.21.0. Items 4 and 8
remain for the user (npm publish / working-note triage).

Post-feature polish sweep (2026-07-05). Smaller than a roadmap arc —
each item is a self-contained refinement, not a new capability. Grouped
by surface, tagged with a priority and whether I'll execute now or leave
for review.

## Site (svelterm-site)

1. **Docs code-block syntax highlighting** — HIGH, execute.
   Docs (`/docs/*`) render mdsvex `<pre>` blocks with no highlighting;
   the playground editor (CodeMirror) already highlights. Port hubcap's
   Shiki dual-theme setup (`github-light`/`github-dark`) via mdsvex's
   `highlight` option, wired to the site's `data-theme` toggle.

2. **Docs code-block copy buttons** — MEDIUM, execute.
   The playground has a copy button; docs code blocks don't. Add a small
   hover copy button to `.prose pre` (progressive-enhancement JS).

3. **Reference matrix readability on mobile** — LOW, execute if quick.
   The wide feature table in `docs/reference.md` should scroll inside its
   own container rather than pushing the page wide.

4. **Stale npm link in the header** — BLOCKED (needs publish).
   The header npm icon points at `@svelterm/core`, still 0.1.0 on npm.
   Nothing to fix in code until a publish lands; noted, not executed.

## Library (svelterm)

5. **DevTools collapsible tree** — MEDIUM, execute.
   The devtools tree is flat-indented; large trees are unwieldy. Add
   collapse/expand (←/→ or Enter) so subtrees fold. Contained change in
   the DevTools component + client flatten logic.

6. **DevTools style panel: show more of what's set** — LOW, execute if quick.
   The right panel lists a fixed subset of style keys; show any non-
   default resolved value instead of a hardcoded list, so nothing is
   hidden.

7. **`svt`/`devtools` connection error copy** — LOW, execute.
   Make the "cannot connect" message name the exact command to enable
   debug mode, consistently across `svt` and `devtools`.

## Housekeeping (leave for review — do not delete)

8. **Stale `BRIEF-*.md` working notes** — user's notes; list, don't touch.
   `svelterm/BRIEF-cleanup-for-push.md`, `BRIEF-table-style-parity.md`;
   `svelterm-site/BRIEF-embedded-terminal-polish.md`,
   `BRIEF-terminal-preview-blank.md`. Flag for the user to triage.

## Standing blockers (user)

- npm publishes need an interactive OTP per publish.
- Site deploys need `aws sso login --profile tyanroot`.

## Execution order

Site highlighting (1) → docs copy buttons (2) → reference mobile (3) →
DevTools collapsible tree (5) → style panel (6) → error copy (7). Each
ships with its normal release discipline where a version is involved
(library items → a svelterm release; site items → a site commit +
queued deploy).
