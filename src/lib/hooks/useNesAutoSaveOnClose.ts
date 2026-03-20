"use client";

import { useEffect, useRef, useCallback } from "react";
import type { NesCore } from "@/lib/nes/core-adapter";
import type { Slot } from "@/lib/storage/nesSaveStateStore";

const AUTO_SAVE_INTERVAL = 30_000;

export function useNesAutoSaveOnClose({
    coreRef,
    romHash,
    romName,
    enabled,
    slot = 1,
    setMessage,
    onSaveVersion,
}: {
    coreRef: React.RefObject<NesCore | null>;
    romHash: string;
    romName: string;
    enabled: boolean;
    slot?: Slot;
    setMessage?: (s: string) => void;
    onSaveVersion?: () => void;
}) {
    const savingRef = useRef(false);

    const doSave = useCallback(() => {
        if (savingRef.current || !romHash) return;
        savingRef.current = true;
        try {
            const c = coreRef.current;
            if (!c) return;
            const data = c.saveState();
            if (!data) return;

            const { putNesSaveState, putNesMeta } = require("@/lib/storage/nesSaveStateStore");
            putNesSaveState(romHash, slot, data);
            putNesMeta({ romHash, romName, updatedAt: Date.now(), lastSlot: slot });
            onSaveVersion?.();
            setMessage?.(`Auto-saved to slot ${slot}.`);
        } catch {
            // ignore
        } finally {
            savingRef.current = false;
        }
    }, [coreRef, romHash, romName, slot, setMessage, onSaveVersion]);

    useEffect(() => {
        if (!enabled || !romHash) return;

        const interval = setInterval(() => {
            const c = coreRef.current;
            if (c?.status === "running") doSave();
        }, AUTO_SAVE_INTERVAL);

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
