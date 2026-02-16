"use client";

import { KeyboardHintsGrid } from "@/components/gba/KeyboardHints";
import type { Slot } from "@/lib/storage/saveStateStore";
import type { useTurbo } from "@/lib/hooks/useTurbo";
import { TurboRate } from "@/lib/gba/core-adapter";

export function SettingsPanel({
    show,
    open,
    onClose,
    canInteract,
    onSave,
    onLoad,

    turbo,
    setTurbo,

    autoSaveEnabled,
    setAutoSaveEnabled,
    autoSaveSlot,
    setAutoSaveSlot,
}: {
    show: boolean;
    open: boolean;
    onClose: () => void;

    canInteract: boolean;
    onSave: (s: Slot) => void;
    onLoad: (s: Slot) => void;

    turbo: TurboRate;
    setTurbo: (t: TurboRate) => void;

    autoSaveEnabled: boolean;
    setAutoSaveEnabled: (v: boolean) => void;
    autoSaveSlot: Slot;
    setAutoSaveSlot: (s: Slot) => void;
}) {
    if (!show) return null;

    return (
        <>
            <div
                className={[
                    "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
                    open ? "opacity-100" : "opacity-0",
                ].join(" ")}
                onClick={onClose}
            />

            <div
                className={[
                    "fixed right-0 top-0 z-50 h-full w-90 max-w-[90vw] bg-(--panel) p-6 shadow-(--shadow-2) overflow-y-auto border-l border-(--border)",
                    "transition-transform duration-200 ease-out will-change-transform",
                    open ? "translate-x-0" : "translate-x-full",
                ].join(" ")}
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <button onClick={onClose} className="text-sm text-(--muted)" type="button">
                        ✕
                    </button>
                </div>

                <div className="mt-4 rounded-2xl bg-(--panel-2) p-3 text-sm text-(--text)">
                    <div className="font-medium">Tips</div>
                    • ต่อจอยแล้วกดปุ่มได้ทันที (Gamepad API) <br />
                    • มือถือ: ปุ่ม overlay อยู่บนจอ (กดค้างได้)
                </div>

                {/* Turbo */}
                <div className="mt-6">
                    <div className="text-base font-semibold">Turbo Mode</div>
                    <div className="mt-3 flex gap-2">
                        {([1, 2, 4] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTurbo(t)}
                                className={[
                                    "rounded-xl px-3 py-2 text-sm border border-(--border) transition",
                                    t === turbo ? "bg-(--accent) text-white" : "bg-(--panel) text-(--text) hover:-translate-y-px",
                                ].join(" ")}
                            >
                                {t}x
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 text-xs text-(--muted)">
                        * ถ้า core ยังไม่รองรับ setTurbo/setSpeedMultiplier จะเป็น “UI only” ก่อน
                    </div>
                </div>

                {/* Auto Save */}
                <div className="mt-6">
                    <div className="text-base font-semibold">Auto Save</div>

                    <label className="mt-3 inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--panel) px-3 py-2">
                        <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={autoSaveEnabled}
                            onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                        />
                        <span className="text-sm">Auto save on page close</span>
                    </label>

                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-sm text-(--muted)">Slot</span>
                        {([1, 2, 3] as const).map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setAutoSaveSlot(s)}
                                disabled={!autoSaveEnabled}
                                className={[
                                    "rounded-xl px-3 py-2 text-sm border border-(--border) transition disabled:opacity-50",
                                    s === autoSaveSlot ? "bg-(--accent) text-white" : "bg-(--panel) text-(--text)",
                                ].join(" ")}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Save/Load */}
                <div className="mt-6">
                    <div className="text-base font-semibold">Save / Load</div>
                    <div className="mt-3 space-y-2">
                        {([1, 2, 3] as const).map((s) => (
                            <div
                                key={s}
                                className="flex items-center justify-between rounded-2xl border border-(--border) bg-(--panel) p-3"
                            >
                                <div className="font-medium">Slot {s}</div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onSave(s)}
                                        className="rounded-xl px-3 py-2 text-sm text-white disabled:opacity-50 bg-(--accent)"
                                        disabled={!canInteract}
                                        type="button"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => onLoad(s)}
                                        className="rounded-xl border border-(--border) px-3 py-2 text-sm disabled:opacity-50"
                                        disabled={!canInteract}
                                        type="button"
                                    >
                                        Load
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Keyboard */}
                <div className="mt-6">
                    <div className="text-base font-semibold">Keyboard Controls</div>
                    <KeyboardHintsGrid />
                </div>
            </div>
        </>
    );
}