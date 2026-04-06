/**
 * Detect terminal background color via OSC 11 query.
 * Returns 'dark' or 'light' based on perceived luminance.
 */
export function detectColorScheme(): Promise<'dark' | 'light'> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            cleanup()
            resolve('dark') // default to dark if no response
        }, 200)

        const chunks: Buffer[] = []

        const onData = (data: Buffer) => {
            chunks.push(data)
            const combined = Buffer.concat(chunks).toString()

            // Look for OSC 11 response: \x1b]11;rgb:RRRR/GGGG/BBBB\x1b\\ or \x07
            const match = combined.match(/\x1b\]11;rgb:([0-9a-f]+)\/([0-9a-f]+)\/([0-9a-f]+)/i)
            if (match) {
                cleanup()
                const r = parseInt(match[1].substring(0, 2), 16)
                const g = parseInt(match[2].substring(0, 2), 16)
                const b = parseInt(match[3].substring(0, 2), 16)
                // Perceived luminance (ITU-R BT.709)
                const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
                resolve(luminance > 128 ? 'light' : 'dark')
            }
        }

        const cleanup = () => {
            clearTimeout(timeout)
            process.stdin.removeListener('data', onData)
        }

        process.stdin.on('data', onData)

        // Send OSC 11 query
        process.stdout.write('\x1b]11;?\x07')
    })
}

/**
 * Poll terminal color scheme at an interval.
 * Calls onChange when the detected scheme changes.
 * Returns a cleanup function to stop polling.
 */
export function pollColorScheme(
    intervalMs: number,
    onChange: (scheme: 'dark' | 'light') => void,
): () => void {
    let lastScheme: 'dark' | 'light' | null = null
    let running = true

    const poll = async () => {
        if (!running) return
        try {
            const scheme = await detectColorScheme()
            if (scheme !== lastScheme) {
                lastScheme = scheme
                onChange(scheme)
            }
        } catch {
            // ignore detection failures
        }
        if (running) {
            setTimeout(poll, intervalMs)
        }
    }

    poll()

    return () => { running = false }
}
