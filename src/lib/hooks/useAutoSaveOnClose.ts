/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import type { GbaCore } from "@/lib/gba/core-adapter";
import type { Slot } from "@/lib/storage/saveStateStore";

export function useAutoSaveOnClose({
    coreRef,
    romHash,
    enabled,
    slot = 1,
    setMessage,
}: {
    coreRef: React.RefObject<GbaCore | null>;
    romHash: string;
    enabled: boolean;
    slot?: Slot;
    setMessage?: (s: string) => void;
}) {
    const savingRef = useRef(false);

    useEffect(() => {
        if (!enabled) return;
        if (!romHash) return;

        const save = () => {
            if (savingRef.current) return;
            savingRef.current = true;

            try {
                const c: any = coreRef.current;
                if (!c?.saveState) return;

                // beforeunload/pagehide ไม่ควร await
                c.saveState(slot);
                setMessage?.(`Auto-saved (slot ${slot}).`);
            } catch {
                // ignore
            } finally {
                savingRef.current = false;
            }
        };

        const onPageHide = () => save();
        const onVisibility = () => {
            if (document.visibilityState === "hidden") save();
        };

        window.addEventListener("pagehide", onPageHide);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            window.removeEventListener("pagehide", onPageHide);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [coreRef, romHash, enabled, slot, setMessage]);
}