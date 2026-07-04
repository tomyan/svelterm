# Terminal Rendering: Why Inline Mode is Crazy Town

If you've ever used Claude Code or Gemini CLI and noticed the screen flash on resize, or your terminal history disappear, you've hit the fundamental limitations of terminal rendering. Building SvelTERM's inline mode forced us to understand exactly what terminals can and can't do. Here's what we found.

## Two worlds

Terminal applications broadly work in two modes:

**Fullscreen** (alternate buffer): the application takes over the entire screen. Think vim, htop, or any TUI. You enter the alternate screen buffer (`CSI ? 1049 h`), render your UI, and when you exit, the original terminal content is restored. Clean, predictable, no scrollback to worry about.

**Inline**: the application outputs into the main buffer alongside normal shell output. Think npm, cargo build, or streaming LLM responses. Content flows downward, old output scrolls into terminal scrollback. This feels more "CLI native" but introduces a host of problems.

## The core limitation: scrollback is read-only

The terminal's scrollback buffer is write-once. Once a line scrolls off the top of the viewport, no escape sequence can update it. This is the single fact that makes inline rendering difficult.

- **Cursor movement clamps at the viewport**: `CSI A` (cursor up) stops at row 0 of the visible viewport. You cannot cursor into scrollback.
- **No selective scrollback operations**: `CSI 3 J` erases ALL scrollback (your entire terminal session history), but there's no "erase scrollback lines 50-60" or "replace scrollback line 42".
- **Scroll operations are one-way**: `CSI S` (scroll up) pushes lines into scrollback. `CSI T` (scroll down) inserts blank lines at the top but lines pushed off the bottom are lost, not recoverable from scrollback.

We verified this with a simple test: output a marker line, push it into scrollback with 50 more lines, then try to cursor up and update it. The cursor hits the viewport top and overwrites whatever line happens to be there, not the marker.

## What Claude Code does

Claude Code (which uses a heavily forked version of Ink) does cell-level diffing with relative cursor movement. On each render:

1. Diff the previous and next screen buffers cell by cell
2. Use relative cursor movement to update only changed cells
3. Skip unchanged lines entirely

This works well within the viewport. But when content that's already in scrollback needs to change (resize, layout shift, etc.), it hits the wall. The solution: `fullResetSequence_CAUSES_FLICKER` (yes, that's the actual function name).

A full reset:
1. Erases ALL scrollback (`CSI 3 J`) — your entire terminal history, including output from before Claude Code started
2. Clears the screen (`CSI 2 J`)
3. Re-renders the entire conversation history from scratch

This is why you see the whole session flash past on resize. And why your terminal scrollback is empty after a Claude Code session. Every full reset nukes everything and repaints from the top.

The source tracks a `FlickerReason` enum to debug when this happens: `'resize'`, `'offscreen'`, etc. The code is full of careful cursor tracking to minimise how often it needs the nuclear option, but it's unavoidable for certain scenarios.

## What Gemini CLI does

Gemini CLI took a different approach: give up on inline entirely. Despite appearing to be an inline application, it runs in the alternate screen buffer (fullscreen mode) with virtual scrolling. A `ScrollProvider` component manages scroll state in React, rendering only the visible portion.

Their fork of Ink (`@jrichman/ink`) adds:
- `alternateBuffer` option on render
- `incrementalRendering` — line-by-line diffing (only used in alternate buffer mode)
- Content clipped to terminal height (lines beyond the viewport are simply not written)

The scrolling you see in Gemini CLI is all virtual — the terminal's native scrollback is not used. This avoids the entire class of scrollback problems but means you can't scroll up with your terminal's native scroll after the app exits.

## Scroll regions (DECSTBM)

One promising-sounding feature is scroll regions (`CSI top;bottom r`), which restrict scrolling to a portion of the viewport. Combined with `CSI S`/`CSI T`, you can shift content within a bounded region without affecting the rest of the screen.

Claude Code uses this for an optimisation: when a scroll container's offset changes, it uses hardware scroll within a region instead of repainting every row. This is faster and reduces flicker.

But scroll regions don't help with the fundamental scrollback problem. They only work within the visible viewport. Content pushed out of a scroll region (in either direction) is lost, not sent to scrollback.

## Insert and delete line

`CSI n L` (insert line) and `CSI n M` (delete line) can add or remove lines at the cursor position, shifting content below. This enables dynamic content in the middle of the viewport — a frame growing by inserting lines pushes content below it down.

But again, only within the viewport. Lines pushed off the bottom are lost. And you can't insert lines into scrollback.

## The resize problem

All of this comes to a head on terminal resize. When the terminal gets wider:
- Text wrapping changes for all content
- Lines that were wrapped across two rows might now fit on one
- Content in scrollback still shows the old wrapping

When the terminal gets taller:
- Some terminals (iTerm2, kitty) pull lines from scrollback back into the viewport
- These lines show stale content from before the resize
- The application can now cursor-up to reach them, but may not know they're stale

Claude Code handles this with a full reset (flash + repaint everything). Gemini CLI handles it by being fullscreen (just relayout the virtual scroll). Both are compromises.

## Implications for SvelTERM

We designed SvelTERM's inline mode around these realities:

**FrameLog**: an append-only log of frames. Each frame is a component that renders a section of output. The API is a single method: `append(Component, props)`. Frames are rendered in order, streaming downward.

**Automatic lifecycle**: components are automatically freed when they scroll beyond the viewport horizon (roughly 2x viewport height above the cursor). No explicit "archive" or "release" needed. The terminal already has the rendered output — we just stop managing it.

**No scrollback updates**: we never attempt to update scrolled-off content. This means no flicker resets, no nuclear scrollback clearing, no ghost duplicates. The trade-off is stale wrapping on resize for scrolled-off content — but that's what the terminal shows anyway.

**Bounded live area**: only content within reach of the cursor is actively rendered and diffed. Memory is proportional to the visible area, not the session history. A 1000-message conversation uses the same memory as a 10-message one.

The insight that simplifies everything: once you accept that scrollback is read-only, you stop fighting the terminal and start working with it. Content scrolls up, gets frozen, and that's fine. The application focuses on what's on screen right now.

## The full picture

| Approach | Scrollback | Resize | Memory | Flicker |
|---|---|---|---|---|
| Fullscreen (alt buffer) | None | Clean relayout | Full tree | None |
| Claude Code (inline) | Native, but nuked on reset | Full repaint flash | Full tree | On every reset |
| Gemini CLI (fake inline) | Virtual (React state) | Relayout virtual scroll | Full tree | Minimal |
| SvelTERM (planned) | Native, read-only | Live area only | Bounded | None |

The terminal is a 1970s technology that we're still building sophisticated applications on. Understanding its actual capabilities — rather than assuming it works like a browser — is the first step to building something that doesn't fight it.
