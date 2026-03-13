"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultKeymap, type GbaButton } from "@/lib/input";

export type Keymap = Record<string, GbaButton>;

const STORAGE_KEY = "gba:keymap";

function loadKeymap(): Keymap {
    if (typeof window === "undefined") return { ...defaultKeymap };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as Keymap;
    } catch { /* ignore */ }
    return { ...defaultKeymap };
}

function saveKeymap(keymap: Keymap) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keymap));
}

export function useKeymap() {
    const [keymap, setKeymapState] = useState<Keymap>(loadKeymap);

    // sync to localStorage on change
    useEffect(() => {
        saveKeymap(keymap);
    }, [keymap]);

    const setKey = useCallback((code: string, button: GbaButton) => {
        setKeymapState((prev) => {
            // remove any existing binding for this button first
            const next: Keymap = {};
            for (const [k, v] of Object.entries(prev)) {
                if (v !== button) next[k] = v;
            }
            next[code] = button;
            return next;
        });
    }, []);

    const resetToDefaults = useCallback(() => {
        setKeymapState({ ...defaultKeymap });
    }, []);

    return { keymap, setKey, resetToDefaults };
}
