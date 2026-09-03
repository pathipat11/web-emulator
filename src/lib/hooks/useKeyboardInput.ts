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
    enabled = true,
) {
    useEffect(() => {
        if (!enabled) return;

        const activeKeys = new Map<string, B>();

        const hasActiveButton = (button: B) =>
            Array.from(activeKeys.values()).some((activeButton) => activeButton === button);

        const releaseAll = () => {
            const core = coreRef.current;
            const buttons = new Set(activeKeys.values());
            activeKeys.clear();
            if (!core) return;
            for (const button of buttons) core.release(button);
        };

        const onKeyDown = (e: KeyboardEvent) => {
            const btn = keymap[e.code];
            if (!btn) return;
            if (DPAD.has(btn)) e.preventDefault();

            // Ignore browser key-repeat and duplicate keydown events.
            if (activeKeys.has(e.code)) return;

            const core = coreRef.current;
            if (!core) return;
            const buttonAlreadyActive = hasActiveButton(btn);
            activeKeys.set(e.code, btn);
            if (buttonAlreadyActive) return;
            core.press(btn);
        };

        const onKeyUp = (e: KeyboardEvent) => {
            const btn = activeKeys.get(e.code);
            if (!btn) return;
            activeKeys.delete(e.code);

            const core = coreRef.current;
            if (!core) return;
            if (hasActiveButton(btn)) return;
            core.release(btn);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") releaseAll();
        };

        window.addEventListener("keydown", onKeyDown, { passive: false });
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", releaseAll);
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", releaseAll);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            releaseAll();
        };
    }, [coreRef, enabled, keymap]);
}
