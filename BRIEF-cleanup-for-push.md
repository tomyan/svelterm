# Brief: cleanup-for-push across the four repos

## Goal

Get `svelterm`, `svelterm-vt100`, `svelterm-site`, and `svelte-fork` into a state where **pushing to public origins makes sense**. Specifically:

- No half-finished or speculative work in public history.
- Commit messages tell a coherent story to a stranger reading the log.
- Untracked noise either committed, `.gitignore`d, or deleted.
- Decisions about squashing / history-rewriting are made deliberately (not by accident).

Goal is *push-readiness*, not the push itself. The user's stated rule (memory): "Nothing pushed in any repo. User keeps working locally; do not push without explicit confirmation."

## Repo-by-repo state (snapshot 2026-05-06)

### `svelterm-vt100` — github.com/tomyan/svelterm-vt100

Working tree: clean.

Unpushed: 2 commits.

```
8fcd386 TerminalView: drop setTimeout defer, upstream fixes the race
3f2974c TerminalView: defer changeMarker write to a fresh task
```

The pair is a workaround + its retraction in two commits. The pair is technically clean — the second commit's message cites the upstream fix and explains what the first one did wrong. But for outside readers, "ship a workaround, then drop it before pushing" is noise.

**Decision needed:** squash into one commit (cleaner public history), or push as-is (preserves the diagnostic record)?

**Recommendation:** **squash.** Suggested squashed message: *"TerminalView: rely on upstream svelte fix for the customRenderer host-graph reactivity race"*, body summarising the diagnosis at one paragraph and citing sveltejs/svelte#18124. The diagnostic record already lives in the memory file and the brief; the public commit doesn't need to relitigate it.

Either way, both commits are unpushed, so the squash is non-destructive (no force-push).

### `svelte-fork` — github.com/tomyan/svelte (branch: `svelte-custom-renderer`)

Working tree: clean.

Diverges from `upstream/svelte-custom-renderer` (sveltejs/svelte) by 4 commits:

```
c02da93d9 Merge remote-tracking branch 'upstream/svelte-custom-renderer'  ← our recent merge
08575d17e Merge remote-tracking branch 'upstream/svelte-custom-renderer'  ← prior merge
a327b1c1c Revert "fix: use push_renderer_if_inactive in compiled components"
c47e06fb7 fix: use push_renderer_if_inactive in compiled components       ← no-op pair
```

Diverges from `origin/svelte-custom-renderer` (user's fork) by 10 commits — but those 10 are all the new `upstream` commits from the merge plus our merge commit itself. **The no-op pair (`c47e06fb7` + `a327b1c1c`) is already on `origin`** and would need a force-push to remove. The two merge commits are also already on origin.

**Decisions needed:**

1. **Should the no-op pair be removed from history?** It would require a force-push to origin (destructive). Recommendation: **leave it.** The pair is a complete revert; it's small; force-pushing a public branch over a cosmetic noise commit isn't worth the risk of breaking anyone tracking the fork.
2. **Are the merge commits OK as-is?** They're plain `git merge` of upstream; useful for showing "this fork is up-to-date with upstream as of date X". Recommendation: **leave.**

So: nothing to clean. Just `git push origin svelte-custom-renderer` when ready.

### `svelterm` — github.com/tomyan/svelterm

Working tree: **dirty** with three categories of stuff.

**Modified (mid-flight, prior session):**
```
M src/css/color.ts            +48-3
M src/css/compute.ts          +32-changes
M src/css/incremental.ts      +3-1
M src/index.ts                +5-1
M test/css-color-level4.test.ts +5-2
```
This is the `light-dark()` CSS function support + changing `transparent` resolution semantics. Per memory it's "separate prior session, leave alone." Pre-push, it should either be **finished + committed** or **stashed** (so the working tree is clean for the push).

**Unpushed commits:** 5, the cursor work.
```
ed73bf6 Drop the painted-cell cursor in inputs; rely on the real terminal cursor
c5acfb3 Generalise cursor emitter to honour focused inputs
d52c1bf Publish input cursor screen position from paintInput
29f26f7 Add getCursorScreenPos API on TermNode
ffde78c Decouple cursor visibility from enterFullscreen/exitFullscreen
```
Per memory "tests green, awaiting push." These are coherent and ready.

**Untracked files** — each needs a deliberate disposition:

| File | What it is | Suggested disposition |
|---|---|---|
| `BRIEF-real-cursor.md` | The brief that drove the just-shipped cursor work | Delete (work is shipped) — or move to `briefs/archive/` if a directory pattern exists |
| `DESIGN-inline-mode.md` | Forward-looking design doc | Keep + commit, *or* `.gitignore` if it's personal scratch |
| `DESIGN-tables.md` | Forward-looking design doc | Same as above |
| `bench/layout-array-bench.mjs` | Layout benchmark script | Keep + commit (likely useful for repo, with `npm run bench` or similar) — needs a README line if added |
| `bench/layout-bench.ts` | Layout benchmark script | Same as above |
| `blog-terminal-rendering.md` | Blog post draft | Move to a `blog/` or `docs/` dir, or delete from here (probably belongs on the site repo) |
| `test-block-render.html`, `test-scroll.mjs` | Ad-hoc test scripts | Delete (they're scratch) unless they're worth converting into actual tests |

**Decisions needed:**

1. **Disposition of each untracked file** — most likely answers above are right, but each needs a quick yes/no.
2. **What to do with the in-flight CSS `light-dark()` work** — three options:
   - Finish it now (small: ~30-60 min, design already evident from the diff).
   - `git stash` and ship the cursor work alone.
   - Commit it as-is on a dedicated branch and push that branch separately.
   Recommendation: **finish it now** if there's appetite. Otherwise stash. Don't push the cursor work with the CSS changes accidentally bundled.

### `svelterm-site` — github.com/tomyan/svelterm-site

Working tree: dirty.

```
M iframe/index.html
M src/lib/Playground.svelte
M src/lib/examples/counter.txt
?? BRIEF-terminal-preview-blank.md
?? BRIEF-embedded-terminal-polish.md
```

No unpushed commits. HEAD == `origin/main`.

**Modified files** (per memory: pre-existing, mid-flight from a prior session) — same call as svelterm's CSS work: finish + commit, or stash.

**Untracked briefs:**

- `BRIEF-terminal-preview-blank.md` — **obsolete now that #18124 fixed the bug upstream.** Delete.
- `BRIEF-embedded-terminal-polish.md` — current per memory. Either commit (becomes part of repo docs / planning history) or leave untracked (treat as personal scratch). Convention so far has been to leave briefs untracked while active.

## Suggested sequence (clean session)

Do these in order; each is small enough to interrupt and resume.

1. **Trash obsolete brief.** `rm svelterm-site/BRIEF-terminal-preview-blank.md`. (10s)
2. **`svelterm-vt100`: squash the two commits.** `git rebase -i HEAD~2`, mark second `fixup`, write the consolidated message. Verify commit looks right. **Don't push yet.** (~5 min)
3. **`svelterm`: triage untracked files.** Walk the list above, decide for each, end with a clean `git status -uno`. Anything kept goes through normal `git add` + commit on its own logical commit. (~10-15 min)
4. **`svelterm`: decide CSS-work disposition.**
   - If finishing: read the diff, run `npm test`, commit on a separate logical commit ahead of the cursor work or on its own branch.
   - If stashing: `git stash push -m "wip: light-dark() css support"` and note in memory.
   (~5-60 min depending on choice)
5. **`svelterm-site`: same call on the three modified files.** Finish + commit, or stash. (~5-30 min)
6. **Slice 5f close-out** — confirm the tinyconfig kernel has no 9p driver and write a one-liner commit/note retiring the slice. Per memory: "Almost certainly moot." (~10 min)
7. **Final cross-repo sanity check.** `git status` clean across all four. `git log --oneline -5` reads coherently in each. Memory entry updated. (~5 min)
8. **Push (separate decision, not part of this brief).** With everything clean, the user can decide push order — likely `svelterm-vt100` and `svelterm` first (no upstream coordination needed), then `svelte-fork` (just an upstream-tracking merge, no novel content), and `svelterm-site` separately whenever the in-flight UI tweaks are settled.

## Open questions to resolve before/during the cleanup session

These are the "ask the user" points — flagging them up-front so the cleanup session doesn't stall.

- [ ] Squash the `svelterm-vt100` workaround pair? *(default: yes)*
- [ ] Force-push to clean the `svelte-fork` no-op revert pair? *(default: no — leave it)*
- [ ] Disposition of each untracked file in `svelterm` — see table.
- [ ] CSS `light-dark()` work in svelterm — finish, stash, or branch?
- [ ] In-flight UI tweaks in `svelterm-site` — finish, stash, or branch?
- [ ] `BRIEF-embedded-terminal-polish.md` — commit or leave untracked?

## Out of scope

- The actual `git push` operations.
- Slice 4 (two-pane flexbox split) — that's design-heavy work, not cleanup.
- Any new features.
- Memory cleanup — but worth checking the memory file once everything else is settled, because the "unpushed commits" lines will need updating.

## Pointers

- Memory: `~/.claude/projects/-Users-tom-projects-svelterm/memory/embedded-terminal-demo.md` for the most recent state snapshot.
- Resolved bug brief (now obsolete): `svelterm-site/BRIEF-terminal-preview-blank.md` — delete in step 1.
- Past pattern for handling an in-flight session: `BRIEF-real-cursor.md` in `svelterm/` (cursor work shipped, brief lingering).
