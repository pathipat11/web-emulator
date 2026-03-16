/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { defaultNesKeymap, type NesButton } from "@/lib/nes/input";
import type { NesCore } from "@/lib/nes/core-adapter";

export function useNesKeyboardInput(
    coreRef: React.RefObject<NesCore | null>,
    keymap?: Record<string, NesButton>,
) {
    useEffect(() => {
        const map = keymap ?? defaultNesKeymap;

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
