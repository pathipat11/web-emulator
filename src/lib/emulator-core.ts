/**
 * Minimal shared interface that all emulator cores implement.
 * Used by generic hooks (keyboard, gamepad, etc.) so they don't
 * need to know about GBA vs NES specifics.
 */
export interface EmulatorCore {
    status: "idle" | "running" | "paused";
    press(btn: string): void;
    release(btn: string): void;
}

/**
 * Generic gamepad mapping shape shared across systems.
 */
export interface GamepadMapping<B extends string = string> {
    buttons: Partial<Record<number, B>>;
    axes?: {
        x?: { index: number; negative: B; positive: B };
        y?: { index: number; negative: B; positive: B };
        deadzone?: number;
    };
}
