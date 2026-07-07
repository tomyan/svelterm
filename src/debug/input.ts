/**
 * Input domain — injects key/mouse/paste events into the run loop over
 * the debug protocol. Semantic specs are encoded to the same bytes a
 * terminal would send and pushed through the byte-level handlers the
 * StdinRouter drives, so the parsers stay part of the tested path.
 */

import type { DebugDomain } from './server.js'
import { encodeKey, encodeMouse, type KeySpec, type MouseSpec } from '../input/encode.js'

/** The mount()-side byte handlers injection feeds. */
export interface InputHooks {
    key(data: Uint8Array): void
    mouse(data: Uint8Array): void
    paste(text: string): void
}

function toBytes(sequence: string): Uint8Array {
    return Buffer.from(sequence, 'binary')
}

export class InputDomain implements DebugDomain {
    constructor(private hooks: InputHooks) {}

    handle(method: string, params: Record<string, any>): any {
        switch (method) {
            case 'key': return this.key(params as KeySpec)
            case 'text': return this.text(params.text)
            case 'mouse': return this.mouse(params as MouseSpec)
            case 'paste': return this.paste(params.text)
            default: throw new Error(`Unknown Input method: ${method}`)
        }
    }

    private key(spec: KeySpec): Record<string, never> {
        if (typeof spec.key !== 'string') throw new Error('Input.key requires a key name')
        this.hooks.key(toBytes(encodeKey(spec)))
        return {}
    }

    private text(text: unknown): Record<string, never> {
        if (typeof text !== 'string') throw new Error('Input.text requires text')
        for (const ch of text) {
            this.hooks.key(toBytes(encodeKey({ key: ch })))
        }
        return {}
    }

    private mouse(spec: MouseSpec): Record<string, never> {
        if (typeof spec.x !== 'number' || typeof spec.y !== 'number') {
            throw new Error('Input.mouse requires x and y cell coordinates')
        }
        this.hooks.mouse(toBytes(encodeMouse(spec)))
        return {}
    }

    private paste(text: unknown): Record<string, never> {
        if (typeof text !== 'string') throw new Error('Input.paste requires text')
        this.hooks.paste(text)
        return {}
    }
}
