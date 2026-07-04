# Inline Mode Design

## Problem

Svelterm currently renders in fullscreen mode (alternate screen buffer). This works for apps like dashboards or games, but CLI tools like Claude Code or Gemini CLI need a different model:

- Output streams downward as it's produced
- Previous output scrolls into terminal scrollback
- Only the current section updates in place
- Long sessions shouldn't accumulate unbounded memory

Both Claude Code and Gemini CLI fork Ink to work around these issues. Claude Code does cell-level diffing with relative cursor movement but must do a full terminal clear (with visible flicker) whenever content that's already in scrollback needs to change. Gemini CLI avoids the problem entirely by using the alternate screen buffer with virtual scrolling — effectively fullscreen mode with extra steps.

## Design

### Two zones

```
+----------------------- terminal scrollback ------+
| [archived] Tool output from step 1               | no component in memory
| [archived] Tool output from step 2               | no component in memory
| [archived] LLM response                          | no component in memory
+----------------------- viewport -----------------+
| [live] Current streaming response                 | svelterm render area
| [live] Input prompt (outside FrameLog)            | svelterm render area
+--------------------------------------------------+
```

**Archived zone**: rows above the render origin. Svelterm has "let go" of these — they're already on the terminal and enter scrollback naturally. No components, no layout, no memory.

**Live zone**: the active svelterm render area. Cell buffer, diffing, relative cursor movement — the existing renderer, bounded to this region.

### Archive model

The terminal already has the rendered output on screen. Archiving doesn't require snapshotting or reprinting — it just moves the render origin down, abandoning rows from the top.

Archived content is immutable. Resize doesn't repaint it, even if it wraps oddly at the new width.

Archiving is opt-in. A tool that never archives behaves like the current fullscreen model — all content stays live and reflows on resize. A tool that archives aggressively gets memory savings and no scrollback corruption, at the cost of stale wrapping in archived content after resize. The tool author makes this trade-off per frame.

### API

#### FrameLog

The core abstraction is `FrameLog` — a managed, append-only log of frames. Each frame is rendered by a component or snippet provided at append time.

```typescript
interface FrameLog {
  /** Append a new frame, rendered by the given component/snippet with props.
   *  Returns the frame's auto-incrementing ID. */
  append<T>(render: Component<T> | Snippet<[T]>, props: T): number

  /** Update a live frame's props, triggering a re-render. */
  update<T>(id: number, props: T): void

  /** Archive consecutive frames from the top.
   *  Moves the render origin past their rows, unmounts their
   *  components, and frees layout/style/node data.
   *  Frames must be archived in order — only consecutive frames
   *  from the top of the log can be archived. */
  archive(id: number): void

  /** Remove a frame entirely (rare — e.g. redacting content).
   *  Clears the frame's rows and repaints the live area. */
  remove(id: number): void
}
```

`FrameLog` is a component that renders its managed frames and exposes the control API:

```svelte
<script lang="ts">
  import { FrameLog } from '@svelterm/core'

  let log: FrameLog
</script>

<FrameLog bind:this={log} />
<InputPrompt onsubmit={handleSubmit} />
```

The input prompt sits outside `FrameLog` — it's always live, never archived.

#### Frame rendering

Each frame specifies its own renderer at append time. This avoids stringly-typed dispatch and gives full type safety per frame:

```typescript
// Each frame type is a component with typed props
const promptId = log.append(UserPrompt, { text: 'explain this code' })

const responseId = log.append(AssistantResponse, { content: '', streaming: true })
log.update(responseId, { content: 'Here is...', streaming: true })
log.update(responseId, { content: 'Here is the explanation.', streaming: false })

const toolId = log.append(ToolOutput, { name: 'grep', result: '...' })
```

Snippets work too, for lightweight inline frames:

```svelte
{#snippet statusLine(props: { message: string })}
  <div class="status">{props.message}</div>
{/snippet}

<script>
  log.append(statusLine, { message: 'Build complete.' })
</script>
```

#### Archiving

Archive freezes consecutive frames from the top of the log:

```typescript
// After the prompt and response are both done:
log.archive(responseId)
// This archives frames 1 (prompt) and 2 (response) together,
// since archive always covers everything up to the given ID.
```

What happens:
1. Svelterm calculates the total row height of frames up to `responseId`
2. Moves the render origin down by that many rows — the terminal already has this content on screen
3. Unmounts those frames' Svelte components
4. Frees their node trees, resolved styles, and layout boxes
5. Future renders only diff/update the remaining live area

#### Removing

Remove is for the rare case where content should actually disappear (e.g. redacting sensitive output):

```typescript
log.remove(toolId) // clears the rows, repaints live area
```

This is distinct from archive — the rows are cleared and live content reflows to fill the gap.

#### Multiple live frames

Multiple frames can be live simultaneously. This is unusual but valid — for example, a progress indicator above a streaming response:

```typescript
const progressId = log.append(ProgressBar, { percent: 0 })
const responseId = log.append(AssistantResponse, { content: '' })

// Update both in parallel
log.update(progressId, { percent: 50 })
log.update(responseId, { content: 'partial...' })

// When done, archive both
log.archive(responseId)
```

The constraint is only on archiving: frames archive from the top in order. A frame can only be archived once all frames above it are also archived.

### Example: CLI tool session

```typescript
async function handleSession(log: FrameLog) {
  while (true) {
    const input = await getInput()
    const promptId = log.append(UserPrompt, { text: input })

    const responseId = log.append(AssistantResponse, {
      content: '', streaming: true,
    })

    for await (const chunk of streamResponse(input)) {
      log.update(responseId, {
        content: chunk.accumulated, streaming: true,
      })
    }
    log.update(responseId, {
      content: finalContent, streaming: false,
    })

    // Both prompt and response are done — archive them
    log.archive(responseId)
    // Components freed, rows in scrollback, ready for next turn
  }
}
```

### Resize behaviour

On terminal resize:

- **Archived content**: untouched. Already in scrollback, may wrap at old width.
- **Live content**: full relayout and repaint within the live area. The cell buffer resizes, layout recomputes, and a diff is emitted. This is the existing behaviour, just bounded to the live zone.

### Rendering

The live zone uses the existing cell buffer and diff mechanism. The only change is cursor management:

- **No absolute positioning**: we don't know where the live area starts on screen, so all cursor movement is relative.
- **Origin tracking**: we track the cursor's position relative to the live area's top-left corner.
- **Growth**: when the live area grows (new content appended), we emit `\n` (LF) to create new lines. Cursor-down (`CSI B`) can't scroll past the viewport bottom, but LF can.
- **Shrinking**: when the live area shrinks (content removed or archived), we erase trailing lines and move the cursor up.
- **Synchronized output**: wrap frame updates in `CSI ? 2026 h` / `CSI ? 2026 l` to prevent flicker in terminals that support it.

### Memory model

In fullscreen mode, the entire component tree lives for the app's lifetime. In inline mode with archiving:

- Archived frames have their Svelte components unmounted. The node tree, styles, layout, and cell buffer region are freed.
- The live area's memory is proportional to what's currently on screen, not the total session history.
- A 1000-message conversation with proper archiving uses memory proportional to the currently active frames.

### Entry point

The existing `run()` function gets a new mode:

```typescript
interface RunOptions {
  /** 'fullscreen' uses alternate screen buffer (default).
   *  'inline' renders in the main buffer with streaming output. */
  mode?: 'fullscreen' | 'inline'
  css?: string
  mouse?: boolean
  debug?: boolean
  io?: TerminalIO
}

run(App, { mode: 'inline' })
```

In inline mode:
- No alternate screen buffer
- No terminal clear on startup
- Raw mode is still enabled (for keyboard/mouse input)
- Cursor is hidden within the live area
- On cleanup, cursor is shown and positioned after the live area

### Comparison to alternatives

| | Svelterm inline | Claude Code | Gemini CLI |
|---|---|---|---|
| Rendering | Cell-level diff | Cell-level diff | Line-level diff |
| Scrollback | Native terminal | Native (with flicker on update) | Virtual (alternate buffer) |
| Resize | Live area only | Full reset + flicker | Full redraw |
| Memory | Archived frames freed | Full tree retained | Full tree retained |
| Scrollback updates | Never attempted | Attempted, causes flicker | N/A (no real scrollback) |

## Implementation plan

1. **Relative cursor renderer**: adapt the existing diff output to use relative cursor movement instead of absolute positioning. This is needed for both inline mode and as a foundation for everything else.

2. **FrameLog component**: manages the frame list, render origin, and live area boundary. Provides append/update/archive/remove API. Instantiates frame components/snippets.

3. **Archive mechanism**: on archive, calculate row height of archived frames, move origin, unmount components, free resources.

4. **Remove mechanism**: on remove, clear rows, reflow live area, unmount component.

5. **Resize handling**: only relayout/repaint the live area. Archived content is untouched.

6. **Site demo**: add an inline mode example to the playground showing streaming output with frame archiving.
