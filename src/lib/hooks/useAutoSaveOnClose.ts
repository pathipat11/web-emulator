/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import type { GbaCore } from "@/lib/gba/core-adapter";
import type { Slot } from "@/lib/storage/saveStateStore";
import { putMeta, putSaveState } from "@/lib/storage/saveStateStore";

export function useAutoSaveOnClose({
    coreRef,
    romHash,
    romName,
    enabled,
    slot = 1,
    setMessage,
}: {
    coreRef: React.RefObject<GbaCore | null>;
    romHash: string;
    romName: string;
    enabled: boolean;
    slot?: Slot;
    setMessage?: (s: string) => void;
}) {
    const savingRef = useRef(false);

    useEffect(() => {
        if (!enabled) return;
        if (!romHash) return;

        const save = async () => {
            if (savingRef.current) return;
            savingRef.current = true;
            try {
                const c: any = coreRef.current;
                if (!c?.saveStateBytes) {
                    // ถ้า core ไม่มี export bytes -> ให้คุณ map เองภายหลัง
                    setMessage?.("Auto-save skipped (core has no saveStateBytes).");
                    return;
                }

                const bytes: Uint8Array = await c.saveStateBytes(slot);
                putSaveState(romHash, slot, bytes);

                putMeta({
                    romHash,
                    romName,
                    updatedAt: Date.now(),
                    lastSlot: slot,
                });

                setMessage?.(`Auto-saved (slot ${slot}).`);
            } catch {
                // ignore
            } finally {
                savingRef.current = false;
            }
        };

        const onBeforeUnload = () => {
            // ก่อนปิดแท็บ/รีเฟรช
            void save();
        };

        const onVisibility = () => {
            // สลับแท็บ/ซ่อนหน้า
            if (document.visibilityState === "hidden") void save();
        };

        window.addEventListener("beforeunload", onBeforeUnload);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            window.removeEventListener("beforeunload", onBeforeUnload);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [coreRef, romHash, romName, enabled, slot, setMessage]);
}