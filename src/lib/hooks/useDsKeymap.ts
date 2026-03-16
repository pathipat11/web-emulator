"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultDsKeymap, type DsButton } from "@/lib/ds/input";

export type DsKeymap = Record<string, DsButton>;

const STORAGE_KEY = "ds:keymap";

function loadKeymap(): DsKeymap {
    if (typeof window === "undefined") return { ...defaultDsKeymap };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as DsKeymap;
    } catch { /* ignore */ }
    return { ...defaultDsKeymap };
}

function saveKeymap(keymap: DsKeymap) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keymap));
}

export function useDsKeymap() {
    const [keymap, setKeymapState] = useState<DsKeymap>(loadKeymap);

    useEffect(() => {
        saveKeymap(keymap);
    }, [keymap]);

    const setKey = useCallback((code: string, button: DsButton) => {
        setKeymapState((prev) => {
            const next: DsKeymap = {};
            for (const [k, v] of Object.entries(prev)) {
                if (v !== button) next[k] = v;
            }
            next[code] = button;
            return next;
        });
    }, []);

    const resetToDefaults = useCallback(() => {
        setKeymapState({ ...defaultDsKeymap });
    }, []);

    return { keymap, setKey, resetToDefaults };
}
