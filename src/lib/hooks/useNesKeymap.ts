"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultNesKeymap, type NesButton } from "@/lib/nes/input";

export type NesKeymap = Record<string, NesButton>;

const STORAGE_KEY = "nes:keymap";

function loadKeymap(): NesKeymap {
    if (typeof window === "undefined") return { ...defaultNesKeymap };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as NesKeymap;
    } catch { /* ignore */ }
    return { ...defaultNesKeymap };
}

function saveKeymap(keymap: NesKeymap) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keymap));
}

export function useNesKeymap() {
    const [keymap, setKeymapState] = useState<NesKeymap>(loadKeymap);

    useEffect(() => {
        saveKeymap(keymap);
    }, [keymap]);

    const setKey = useCallback((code: string, button: NesButton) => {
        setKeymapState((prev) => {
            const next: NesKeymap = {};
            for (const [k, v] of Object.entries(prev)) {
                if (v !== button) next[k] = v;
            }
            next[code] = button;
            return next;
        });
    }, []);

    const resetToDefaults = useCallback(() => {
        setKeymapState({ ...defaultNesKeymap });
    }, []);

    return { keymap, setKey, resetToDefaults };
}
