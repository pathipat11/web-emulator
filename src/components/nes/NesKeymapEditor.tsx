"use client";

import { useCallback, useEffect, useState } from "react";
import type { NesButton } from "@/lib/nes/input";
import type { Keymap } from "@/lib/hooks/useKeymap";

const BUTTONS: { button: NesButton; label: string }[] = [
    { button: "UP", label: "D-Pad Up" },
    { button: "DOWN", label: "D-Pad Down" },
    { button: "LEFT", label: "D-Pad Left" },
    { button: "RIGHT", label: "D-Pad Right" },
    { button: "A", label: "A" },
    { button: "B", label: "B" },
    { button: "START", label: "Start" },
    { button: "SELECT", label: "Select" },
];

function codeToLabel(code: string): string {
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Arrow")) return "Arrow " + code.slice(5);
    if (code === "ShiftLeft") return "Left Shift";
    if (code === "ShiftRight") return "Right Shift";
    if (code === "Space") return "Space";
    return code.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function getCodeForButton(keymap: Keymap<NesButton>, button: NesButton): string | null {
    for (const [code, btn] of Object.entries(keymap)) {
        if (btn === button) return code;
    }
    return null;
}

type Props = {
    keymap: Keymap<NesButton>;
    onSetKey: (code: string, button: NesButton) => void;
    onReset: () => void;
};

export function NesKeymapEditor({ keymap, onSetKey, onReset }: Props) {
    const [listening, setListening] = useState<NesButton | null>(null);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!listening) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.code === "Escape") { setListening(null); return; }
            onSetKey(e.code, listening);
            setListening(null);
        },
        [listening, onSetKey],
    );

    useEffect(() => {
        if (!listening) return;
        window.addEventListener("keydown", handleKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
    }, [listening, handleKeyDown]);

    return (
        <div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {BUTTONS.map(({ button, label }) => {
                    const code = getCodeForButton(keymap, button);
                    const isListening = listening === button;
                    return (
                        <button
                            key={button}
                            type="button"
                            onClick={() => setListening(isListening ? null : button)}
                            className={[
                                "flex items-center justify-between rounded-xl border px-3 py-2 transition",
                                isListening
                                    ? "border-(--accent) bg-(--accent)/10 ring-1 ring-(--accent)"
                                    : "border-(--border) bg-(--panel) hover:border-(--accent)/50",
                            ].join(" ")}
                        >
                            <span className="text-(--muted)">{label}</span>
                            <span className="font-medium">
                                {isListening ? (
                                    <span className="animate-pulse text-(--accent)">Press a key...</span>
                                ) : code ? codeToLabel(code) : (
                                    <span className="text-(--muted)">—</span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
            <button
                type="button"
                onClick={onReset}
                className="mt-3 rounded-xl border border-(--border) px-3 py-2 text-xs text-(--muted) hover:text-(--text) transition"
            >
                Reset to defaults
            </button>
        </div>
    );
}
