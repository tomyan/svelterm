# Roadmap 3: the "Later" list

Follows PLAN-ROADMAP.md (0.2.0–0.10.0) and PLAN-ROADMAP-2.md
(0.11.0–0.17.0). Same release checklist per arc: tests, docs, changelog,
version bump, tag, GitHub release, npm attempt, site-deploy queue.

## Arc 1 — Scroll-region diffing (0.18.0)

After a scroll, content shifts vertically and nearly every viewport cell
differs, so the diff emits a full repaint. DECSTBM (`CSI t;b r`) lets the
terminal shift already-drawn rows itself — emit a scroll + paint only the
newly revealed rows. Payoff is smoothness over slow links (ssh) and less
output on scroll-heavy UIs.

- [ ] Slice 1: detect vertical translation — a diff helper that spots
      when `next` is `prev` shifted by ±N rows over a column range, with
      only the entering rows new.
- [ ] Slice 2: emit DECSTBM set-region + index/reverse-index + the new
      rows, then reset the region; fall back to the normal cell diff when
      no clean translation exists or the region is the whole screen with
      an unsupported terminal.
- [ ] Slice 3: gate on capability (assume supported; harmless if not —
      but prefer the plain diff when detection says the terminal lacks
      it). Bench the emitted-bytes reduction on a scrolling list.

## Arc 2 — Kitty graphics (0.19.0)

`<img>` renders as half-blocks everywhere; on kitty-protocol terminals,
transmit real pixels for crisp images. Gated on the capability already
detected (XTVERSION / graphics query).

- [ ] Slice 1: transmit + place RGBA via the kitty graphics protocol at
      an `<img>`'s cell box (base64 chunked payload, placement id keyed
      to the node).
- [ ] Slice 2: lifecycle — delete the placement when the image moves,
      resizes, scrolls out, or unmounts; re-place on change. Keep it
      correct (delete-all-ours + re-place per frame) before clever.
- [ ] Slice 3: half-block fallback stays the default; kitty path only
      when detected. Docs note in elements.md + terminals.md.

## Arc 3 — DevTools TUI (0.1.0, new surface)

A terminal app — built with svelterm — that connects to a debug server
(`run(App, { debug: true })`) and inspects it live: node tree on the
left, selected node's computed style + box on the right. Dogfoods the
renderer, the debug domains, and @svelterm/ui.

- [ ] Slice 1: a `svt ui` / `svelterm devtools` command that connects,
      pulls `DOM.getDocument`, and renders the tree with @svelterm/ui's
      List (collapsible depth is a nice-to-have; flat indented first).
- [ ] Slice 2: selecting a node fetches `CSS.getComputedStyle` +
      `DOM.getBoxModel` and shows them in a side panel (Tabs: Styles /
      Box).
- [ ] Slice 3: live refresh (poll `getDocument` or re-fetch on a key);
      README + docs.

## Standing blockers (user)

- npm publishes need an interactive OTP per publish.
- Site deploys need `aws sso login --profile tyanroot`.
