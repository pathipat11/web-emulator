/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { defaultKeymap } from "@/lib/input";
import type { GbaCore } from "@/lib/gba/core-adapter";

export function useKeyboardInput(coreRef: React.RefObject<GbaCore | null>) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const core = coreRef.current;
            if (!core) return;
            const btn = defaultKeymap[e.code];
            if (!btn) return;
            if (btn === "UP" || btn === "DOWN" || btn === "LEFT" || btn === "RIGHT") e.preventDefault();
            core.press(btn);
        };

        const onKeyUp = (e: KeyboardEvent) => {
            const core = coreRef.current;
            if (!core) return;
            const btn = defaultKeymap[e.code];
            if (!btn) return;
            core.release(btn);
        };

        window.addEventListener("keydown", onKeyDown, { passive: false });
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown as any);
            window.removeEventListener("keyup", onKeyUp as any);
        };
    }, [coreRef]);
}