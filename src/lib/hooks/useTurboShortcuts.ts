/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import type { GbaCore, TurboRate } from "@/lib/gba/core-adapter";
import { useTurboToast } from "@/components/gba/TurboToastProvider";

export function useTurboShortcuts({
    coreRef,
    turbo,
    setTurbo,
    holdKey = "Shift",
    holdRate = 4,
}: {
    coreRef: React.RefObject<GbaCore | null>;
    turbo: TurboRate; // current rate
    setTurbo: (r: TurboRate) => void;
    holdKey?: "Shift" | "Space";
    holdRate?: TurboRate; // 2 or 4
}) {
    const prevRef = useRef<TurboRate>(turbo);
    const holdingRef = useRef(false);
    const { showTurboToast } = useTurboToast();

    // keep prev updated when not holding
    useEffect(() => {
        if (!holdingRef.current) prevRef.current = turbo;
    }, [turbo]);

    useEffect(() => {
        const isTypingTarget = (t: EventTarget | null) => {
            const el = t as HTMLElement | null;
            if (!el) return false;
            const tag = el.tagName?.toLowerCase();
            return tag === "input" || tag === "textarea" || el.isContentEditable;
        };

        const apply = (rate: TurboRate, label?: string) => {
            setTurbo(rate);
            const c: any = coreRef.current;
            if (typeof c?.setTurbo === "function") c.setTurbo(rate);
            else if (typeof c?.setSpeedMultiplier === "function") c.setSpeedMultiplier(rate);

            showTurboToast(rate, { label });
        };


        const cycle = () => {
            const next: TurboRate = turbo === 1 ? 2 : turbo === 2 ? 4 : 1;
            apply(next, "Cycle");
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            if (isTypingTarget(e.target)) return;

            // hold-to-turbo
            if (e.key === holdKey) {
                if (!holdingRef.current) {
                    holdingRef.current = true;
                    prevRef.current = turbo;
                    apply(holdRate, "Hold");
                }
                return;
            }

            // cycle
            if (e.key.toLowerCase() === "t") {
                e.preventDefault();
                cycle();
                return;
            }

            // direct set
            if (e.key === "1" || e.key === "2" || e.key === "4") {
                e.preventDefault();
                apply(Number(e.key) as TurboRate, "Key");
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target)) return;

            if (e.key === holdKey && holdingRef.current) {
                holdingRef.current = false;
                apply(prevRef.current);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
        // turbo is used for cycle + prev tracking
    }, [coreRef, turbo, setTurbo, holdKey, holdRate, showTurboToast]);
}