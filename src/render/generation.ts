/**
 * Full-paint generation counter. Values cached on nodes during paint
 * (cursor positions) carry the generation that wrote them; a full paint
 * bumps it, so anything culled that frame reads as absent instead of
 * reporting stale coordinates. Incremental paints don't bump — nodes
 * they skip are unchanged, so their cached values stay valid.
 */

let generation = 0

export function bumpPaintGeneration(): number {
    return ++generation
}

export function paintGeneration(): number {
    return generation
}
