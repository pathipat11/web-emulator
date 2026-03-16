/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { defaultDsKeymap, type DsButton } from "@/lib/ds/input";
import type { DsCore } from "@/lib/ds/core-adapter";

export function useDsKeyboardInput(
    coreRef: React.RefObject<DsCore | null>,
    keymap?: Record<string, DsButton>,
) {
    useEffect(() => {
        const map = keymap ?? defaultDsKeymap;

        const onKeyDown = (e: KeyboardEvent) => {
            const core = coreRef.current;
            if (!core) return;
            const btn = map[e.code];
            if (!btn) return;
            if (btn === "UP" || btn === "DOWN" || btn === "LEFT" || btn === "RIGHT") e.preventDefault();
            core.press(btn);
        };

        const onKeyUp = (e: KeyboardEvent) => {
            const core = coreRef.current;
            if (!core) return;
            const btn = map[e.code];
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
