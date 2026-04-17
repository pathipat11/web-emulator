/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import type { EmulatorCore } from "@/lib/emulator-core";

const DPAD = new Set(["UP", "DOWN", "LEFT", "RIGHT"]);

/**
 * Generic keyboard input hook — works for any system.
 *
 * @param coreRef   ref to the emulator core
 * @param keymap    current key→button mapping
 */
export function useKeyboardInput<B extends string>(
    coreRef: React.RefObject<EmulatorCore | null>,
    keymap: Record<string, B>,
) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const core = coreRef.current;
            if (!core) return;
            const btn = keymap[e.code];
            if (!btn) return;
            if (DPAD.has(btn)) e.preventDefault();
            core.press(btn);
        };

        const onKeyUp = (e: KeyboardEvent) => {
            const core = coreRef.current;
            if (!core) return;
            const btn = keymap[e.code];
            if (!btn) return;
            core.release(btn);
        };

        window.addEventListener("keydown", onKeyDown, { passive: false });
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown as any);
            window.removeEventListener("keyup", onKeyUp as any);
        };
    }, [coreRef, keymap]);
}
