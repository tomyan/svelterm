export const SPINNER_DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
export const SPINNER_LINE = ['|', '/', '-', '\\']
export const SPINNER_BRAILLE = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']

export class Spinner {
    private frames: string[]
    private index: number = 0

    constructor(frames: string[] = SPINNER_DOTS) {
        this.frames = frames
    }

    get frame(): string {
        return this.frames[this.index]
    }

    tick(): void {
        this.index = (this.index + 1) % this.frames.length
    }

    reset(): void {
        this.index = 0
    }
}
