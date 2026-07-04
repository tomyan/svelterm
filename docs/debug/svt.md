# svt — debug CLI

`svt` connects to a running svelterm app's debug server (a WebSocket on
`127.0.0.1`) and inspects its live node tree, styles, and layout from the
command line. Also available as `svelterm inspect`. For an interactive
terminal inspector, see [DevTools](./devtools.md).

## Enabling debug mode

Run the app with `debug: true`:

```ts
run(App, {
    css,
    debug: true,        // start the debug server
    debugPort: 9444,    // optional, default 9444
})
```

The server binds to `127.0.0.1` only. (Note: `svelterm build` bundles
stub out `ws`, so the debug server is a no-op in a shipped bundle — run
from source, or via `svelterm dev`, to inspect.)

## Commands

```bash
svt tree                 # print the whole node tree (tags, attrs, text)
svt query '.card'        # find a node id by CSS selector
svt style <nodeId>       # the resolved computed style svelterm painted
svt box <nodeId>         # the node's layout box (x, y, width, height)
svt console [count]      # recent console entries
svt raw DOM.getDocument '{}'   # any protocol method + JSON params
svt query '.card' --port 9500  # non-default port
```

Output is JSON on stdout — pipe it through `jq`:

```bash
svt query '.card' | jq .nodeId
svt style "$(svt query '.card' | jq .nodeId)" | jq '.style | {fg, width, borderStyle}'
```

## Protocol

The server speaks a small JSON-over-WebSocket protocol: a request is
`{ id, method, params }`, a reply `{ id, result }` or `{ id, error }`.
Domains: `DOM` (`getDocument`, `querySelector`, `getBoxModel`,
`setAttribute`, `removeAttribute`), `CSS` (`getComputedStyle`), and
`Console` (`getEntries`, `clear`). `svt raw <method> <json>` reaches any
of them, so tooling can build on the same channel.
