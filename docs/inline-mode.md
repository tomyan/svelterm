# Inline mode

Fullscreen apps own the alternate screen. CLI tools want the opposite:
output that streams downward, scrolls into the terminal's real
scrollback, and leaves the screen intact on exit — the Claude Code /
Gemini CLI shape. That's inline mode:

```typescript
run(App, { mode: 'inline' })
```

The app renders at the shell's cursor position in the main buffer. The
**live area** sizes itself to the app's content (clamped to the terminal
height) and updates with cell-level diffs; everything above it belongs to
the terminal and is never touched again. All cursor movement is relative
— svelterm never needs to know where on the screen it's running. On exit
the rendered output stays put and the shell prompt continues below it.

## FrameLog

The companion for streaming sessions: an append-only log of frames,
each a mounted component. Archiving a finished frame hands its rows to
the terminal's scrollback and unmounts the component — memory tracks
what's live, not the whole session.

```svelte
<script>
    import { createFrameLog } from '@svelterm/core/app'
    import Message from './Message.svelte'

    function start(el) {
        const log = createFrameLog(el)
        const run = setTimeout(async () => {
            log.append(Message, { role: 'user', text: 'hello' })
            const props = $state({ role: 'assistant', text: '', streaming: true })
            const id = log.append(Message, props)
            for await (const chunk of stream()) props.text += chunk
            props.streaming = false
            log.archive(id)   // this turn scrolls into history, components freed
        }, 0)
        return () => clearTimeout(run)
    }
</script>

<div class="log" {@attach start}></div>
<StatusBar />
```

- **`append(Component, props)`** mounts a frame and returns its id. Pass
  a `$state` object as props to stream updates into it (mutate it, or
  call `update(id, partial)` which assigns onto the same object).
- **`archive(id)`** archives every frame up to and including `id` —
  frames leave from the top, in order. Their rows stay on the terminal
  exactly as rendered.
- **`remove(id)`** deletes a frame outright (redaction); the live area
  reflows to close the gap.
- Get the host element with `{@attach ...}` — `bind:this` is not
  available under the custom renderer. Kick off async work with
  `setTimeout(fn, 0)` so state writes don't re-trigger the attachment.

Try it: `DEMO=inline npm run demo` in the svelterm repo.

## Constraints

- The live area must fit the terminal height — archive finished content
  to keep it short. Content past the bottom clips.
- **Mouse reporting is off** (SGR coordinates are screen-absolute and the
  origin is unknown by design). Keyboard input, focus, and `:focus`
  styling work as usual; the terminal cursor follows focused inputs.
- Archived rows never re-wrap: after a resize they keep their old
  wrapping, like any other scrollback. The live area re-lays-out and
  repaints in place on width changes (best effort — some terminals
  re-wrap the live rows too; the next frame repaints them).
- Every change re-renders the live area fully (it's content-sized, so
  anything can move). Keep live frames modest; archive the rest.
