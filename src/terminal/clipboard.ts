/**
 * Clipboard writes. OSC 52 travels in-band (works over ssh and through
 * multiplexers that pass it on); a platform tool runs as well when one
 * exists, covering terminals with OSC 52 disabled. Failures are silent —
 * copying is best-effort by nature here.
 */

export function osc52Copy(text: string): string {
    const base64 = typeof Buffer !== 'undefined'
        ? Buffer.from(text, 'utf8').toString('base64')
        : btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    return `\x1b]52;c;${base64}\x07`
}

/** The platform clipboard command, if this platform has a common one. */
function platformCopyCommand(): { command: string; args: string[] } | null {
    if (typeof process === 'undefined') return null
    switch (process.platform) {
        case 'darwin': return { command: 'pbcopy', args: [] }
        case 'linux':
            return process.env.WAYLAND_DISPLAY
                ? { command: 'wl-copy', args: [] }
                : { command: 'xclip', args: ['-selection', 'clipboard'] }
        case 'win32': return { command: 'clip', args: [] }
        default: return null
    }
}

/** Write text to the clipboard: OSC 52 through `write`, plus a platform tool. */
export function copyToClipboard(text: string, write: (data: string) => void): void {
    write(osc52Copy(text))
    const tool = platformCopyCommand()
    if (!tool) return
    import('node:child_process').then(({ spawn }) => {
        const child = spawn(tool.command, tool.args, { stdio: ['pipe', 'ignore', 'ignore'] })
        child.on('error', () => { /* tool missing — OSC 52 already sent */ })
        child.stdin.on('error', () => {})
        child.stdin.end(text)
    }).catch(() => {})
}
