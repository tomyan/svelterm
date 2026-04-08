# svt — Debug CLI

`svt` is a command-line client for the Svelterm Debug Protocol. It connects to a running svelterm app's debug server and provides inspection tools.

## Quick start

```bash
# In one terminal: run your app with debug enabled
mount(App, { css, debug: true })

# In another terminal (or tmux pane):
svt console
```

## Auto-discovery

`svt` automatically finds debug servers:

1. **Default port** — tries `localhost:9444` (instant)
2. **tmux-aware** — if running in tmux, scans sibling pane process trees for listening debug ports
3. **Explicit port** — `svt --port 9500`

In tmux, just run `svt` in a pane next to your app — it discovers and connects automatically.

## Commands

### console

Stream console output from the app:

```bash
svt console              # stream live output
svt console --entries    # show buffered entries and exit
```

Output is colored by severity:

- `LOG` — white
- `INF` — cyan
- `WRN` — yellow
- `ERR` — red
- `DBG` — gray

Each line includes a timestamp and the message arguments.

When debug mode is enabled in the app, `console.log/warn/error/info/debug` output is redirected exclusively to debug clients — it doesn't appear on the app's terminal screen.

## Enabling debug mode

In your app's entry point:

```ts
mount(App, {
    css,
    debug: true,        // enable debug server
    debugPort: 9444,    // optional, default 9444
})
```

The debug server only binds to `127.0.0.1` (localhost).

## Future commands

The debug protocol is designed for expansion:

- `svt tree` — inspect the virtual node tree
- `svt styles <nodeId>` — show computed styles
- `svt layout <nodeId>` — show layout box
- `svt highlight <nodeId>` — visually highlight a node
- `svt inspect` — full interactive DevTools TUI (built with svelterm)
