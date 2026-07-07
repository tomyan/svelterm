/**
 * node-pty → TerminalStream adapter for the mux demo. Bytes out are
 * buffered until the first subscriber (the pane may mount after the
 * shell's first prompt); resize forwards TIOCSWINSZ.
 */

import { spawn, type IPty } from 'node-pty'
import { chmodSync } from 'fs'
import { createRequire } from 'module'
import { dirname, join } from 'path'
import type { TerminalStream } from '@svelterm/vt100'

/**
 * npm sometimes drops the execute bit on node-pty's prebuilt
 * spawn-helper, which surfaces as `posix_spawnp failed`. Self-heal.
 */
export function healSpawnHelper(): void {
    try {
        const require = createRequire(import.meta.url)
        const packageRoot = join(dirname(require.resolve('node-pty')), '..')
        const helper = join(packageRoot, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper')
        chmodSync(helper, 0o755)
    } catch {
        // Windows, or a build layout without the helper — nothing to heal
    }
}

export function ptyStream(command: string, args: string[]): TerminalStream {
    const proc: IPty = spawn(command, args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env as Record<string, string>,
    })

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    let output: ((bytes: Uint8Array) => void) | null = null
    const pending: Uint8Array[] = []
    const closeListeners = new Set<(reason: Error | null) => void>()
    let closed = false

    proc.onData(data => {
        const bytes = encoder.encode(data)
        if (output) output(bytes)
        else pending.push(bytes)
    })
    proc.onExit(() => {
        closed = true
        for (const listener of closeListeners) listener(null)
    })

    return {
        onOutput(listener) {
            output = listener
            for (const bytes of pending.splice(0)) listener(bytes)
            return () => { if (output === listener) output = null }
        },
        write(bytes) {
            if (!closed) proc.write(decoder.decode(bytes))
        },
        resize(cols, rows) {
            if (closed) return
            try { proc.resize(cols, rows) } catch { /* racing an exit */ }
        },
        onClose(listener) {
            closeListeners.add(listener)
            return () => closeListeners.delete(listener)
        },
        close() {
            if (closed) return
            closed = true
            try { proc.kill() } catch { /* already gone */ }
        },
    }
}
