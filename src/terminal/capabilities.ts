/**
 * Terminal capability detection: colour depth from the environment and
 * XTVERSION, synchronized-output support via DECRQM. Queries run through
 * the StdinRouter with timeouts, so unresponsive terminals just get
 * conservative defaults.
 */

import type { StdinRouter } from './stdin-router.js'

export type ColorDepth = 'truecolor' | '256' | '16' | 'mono'

export interface TerminalCapabilities {
    colorDepth: ColorDepth
    /** DEC 2026 begin/end synchronized update. */
    syncOutput: boolean
    /** Terminal name and version from XTVERSION, when it answered. */
    terminal: string | null
}

/** Terminals that render truecolor but predate COLORTERM adoption. */
const TRUECOLOR_TERMINALS = /iterm|kitty|wezterm|ghostty|alacritty|contour|rio|vscode/i

export function resolveColorDepth(
    env: Record<string, string | undefined>, xtversion?: string | null,
): ColorDepth {
    if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 'mono'
    const colorterm = env.COLORTERM ?? ''
    if (colorterm === 'truecolor' || colorterm === '24bit') return 'truecolor'
    if (xtversion && TRUECOLOR_TERMINALS.test(xtversion)) return 'truecolor'
    if ((env.TERM ?? '').includes('256color')) return '256'
    return '16'
}

/** Match a DCS > | <text> ST reply to XTVERSION, returning the text. */
export function matchXTVERSION(data: string): string | null {
    const match = /\x1bP>\|([^\x1b]*)\x1b\\/.exec(data)
    return match ? match[1] : null
}

/** Match a DECRQM reply for the given mode. */
export function matchDECRQM(mode: number): (data: string) => string | null {
    const pattern = new RegExp(`\\x1b\\[\\?${mode};\\d\\$y`)
    return data => pattern.exec(data)?.[0] ?? null
}

/** Whether a DECRQM reply says the mode is recognised (set or reset). */
export function decrqmSupported(reply: string | null): boolean {
    if (!reply) return false
    const value = /;(\d)\$y/.exec(reply)?.[1]
    return value === '1' || value === '2'
}

/**
 * Query the live terminal. COLORTERM/NO_COLOR decide colour depth without
 * a query; otherwise XTVERSION identifies known-truecolor terminals.
 */
export async function detectCapabilities(
    router: StdinRouter,
    env: Record<string, string | undefined> = process.env,
): Promise<TerminalCapabilities> {
    const envDepth = resolveColorDepth(env)
    const needsVersion = envDepth === '16' || envDepth === '256'
    const [xtversion, decrqm] = await Promise.all([
        needsVersion ? router.query('\x1b[>0q', matchXTVERSION, 150) : Promise.resolve(null),
        router.query('\x1b[?2026$p', matchDECRQM(2026), 150),
    ])
    return {
        colorDepth: resolveColorDepth(env, xtversion),
        syncOutput: decrqmSupported(decrqm),
        terminal: xtversion,
    }
}
