"use client";

import { useCallback, useEffect, useState } from "react";

export type Keymap<B extends string = string> = Record<string, B>;

/**
 * Generic keymap hook — works for any system.
 *
 * @param storageKey  localStorage key (e.g. "gba:keymap", "nes:keymap")
 * @param defaults    default keymap for the system
 */
export function useKeymap<B extends string>(
    storageKey: string,
    defaults: Keymap<B>,
) {
    const [keymap, setKeymapState] = useState<Keymap<B>>(() => {
        if (typeof window === "undefined") return { ...defaults };
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) return JSON.parse(raw) as Keymap<B>;
        } catch { /* ignore */ }
        return { ...defaults };
    });

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(keymap));
    }, [storageKey, keymap]);

    const setKey = useCallback((code: string, button: B) => {
        setKeymapState((prev) => {
            const next: Keymap<B> = {};
            for (const [k, v] of Object.entries(prev)) {
                if (v !== button) next[k] = v as B;
            }
            next[code] = button;
            return next;
        });
    }, []);

    const resetToDefaults = useCallback(() => {
        setKeymapState({ ...defaults });
    }, [defaults]);

    return { keymap, setKey, resetToDefaults };
}
