/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useCallback } from "react";
import type { GbaCore } from "@/lib/gba/core-adapter";
import type { Slot } from "@/lib/storage/saveStateStore";

const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds

export function useAutoSaveOnClose({
    coreRef,
    romHash,
    enabled,
    slot = 1,
    setMessage,
    onSaveVersion,
}: {
    coreRef: React.RefObject<GbaCore | null>;
    romHash: string;
    enabled: boolean;
    slot?: Slot;
    setMessage?: (s: string) => void;
    onSaveVersion?: () => void;
}) {
    const savingRef = useRef(false);

    const doSave = useCallback(async () => {
        if (savingRef.current) return;
        if (!romHash) return;
        savingRef.current = true;

        try {
            const c: any = coreRef.current;
            if (!c) return;

            if (typeof c.saveStateBytes === "function") {
                const bytes: Uint8Array | null = await c.saveStateBytes(slot);
                if (bytes && bytes.length > 0) {
                    const { putSaveState, putMeta } = await import(
                        "@/lib/storage/saveStateStore"
                    );
                    putSaveState(romHash, slot, bytes);
                    putMeta({
                        romHash,
                        romName: "",
                        updatedAt: Date.now(),
                        lastSlot: slot,
                    });
                    onSaveVersion?.();
                    setMessage?.(`Auto-saved to slot ${slot}.`);
                    return;
                }
            }

            // Fallback: internal save only (won't survive reload)
            if (typeof c.saveState === "function") {
                c.saveState(slot);
            }
        } catch {
            // ignore
        } finally {
            savingRef.current = false;
        }
    }, [coreRef, romHash, slot, setMessage, onSaveVersion]);

    useEffect(() => {
        if (!enabled || !romHash) return;

        // Periodic auto-save every 30s while game is running
        const interval = setInterval(() => {
            const c: any = coreRef.current;
            if (c?.status === "running") {
                doSave();
            }
        }, AUTO_SAVE_INTERVAL);

        // Also try on visibility hidden (best-effort)
        const onVisibility = () => {
            if (document.visibilityState === "hidden") doSave();
        };

        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [enabled, romHash, coreRef, doSave]);
}
