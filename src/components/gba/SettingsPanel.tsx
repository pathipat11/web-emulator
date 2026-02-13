"use client";

import { KeyboardHintsGrid } from "@/components/gba/KeyboardHints";

type Slot = 1 | 2 | 3;

export function SettingsPanel({
    show,
    open,
    onClose,
    canInteract,
    onSave,
    onLoad,
}: {
    show: boolean;
    open: boolean;
    onClose: () => void;
    canInteract: boolean;
    onSave: (s: Slot) => void;
    onLoad: (s: Slot) => void;
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

                <div className="mt-6">
                    <div className="text-base font-semibold">Save / Load</div>
                    <div className="mt-3 space-y-2">
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className="flex items-center justify-between rounded-2xl border border-(--border) bg-(--panel) p-3"
                            >
                                <div className="font-medium">Slot {s}</div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onSave(s as Slot)}
                                        className="rounded-xl px-3 py-2 text-sm text-white disabled:opacity-50 bg-(--accent)"
                                        disabled={!canInteract}
                                        type="button"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => onLoad(s as Slot)}
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

                <div className="mt-6">
                    <div className="text-base font-semibold">Keyboard Controls</div>
                    <KeyboardHintsGrid />
                </div>
            </div>
        </>
    );
}