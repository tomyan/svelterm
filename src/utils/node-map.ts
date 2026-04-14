/**
 * A Map-compatible container keyed by node IDs, backed by a sparse array
 * for fast indexed access. Implements the full Map<number, T> interface
 * so it's a drop-in replacement.
 *
 * ~10x faster than Map.get()/set() for integer keys.
 */
export class NodeMap<T> implements Map<number, T> {
    private items: (T | undefined)[] = []
    private _size = 0
    readonly [Symbol.toStringTag] = 'NodeMap'

    get(id: number): T | undefined {
        return this.items[id]
    }

    set(id: number, value: T): this {
        if (this.items[id] === undefined) this._size++
        this.items[id] = value
        return this
    }

    has(id: number): boolean {
        return this.items[id] !== undefined
    }

    delete(id: number): boolean {
        if (this.items[id] !== undefined) {
            this.items[id] = undefined
            this._size--
            return true
        }
        return false
    }

    get size(): number {
        return this._size
    }

    clear(): void {
        this.items = []
        this._size = 0
    }

    clone(): NodeMap<T> {
        const copy = new NodeMap<T>()
        copy.items = this.items.slice()
        copy._size = this._size
        return copy
    }

    forEach(fn: (value: T, key: number, map: Map<number, T>) => void): void {
        for (let i = 0; i < this.items.length; i++) {
            const v = this.items[i]
            if (v !== undefined) fn(v, i, this)
        }
    }

    *entries(): MapIterator<[number, T]> {
        for (let i = 0; i < this.items.length; i++) {
            const v = this.items[i]
            if (v !== undefined) yield [i, v]
        }
    }

    *values(): MapIterator<T> {
        for (let i = 0; i < this.items.length; i++) {
            const v = this.items[i]
            if (v !== undefined) yield v
        }
    }

    *keys(): MapIterator<number> {
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i] !== undefined) yield i
        }
    }

    [Symbol.iterator](): MapIterator<[number, T]> {
        return this.entries()
    }
}
