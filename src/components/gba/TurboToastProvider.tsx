/* eslint-disable react-hooks/refs */
"use client";

import React, { createContext, useContext, useMemo, useRef, useState } from "react";

type ToastState = {
    visible: boolean;
    rate: 1 | 2 | 4;
    // incrementing id to re-trigger animation even if rate same
    id: number;
};

type Ctx = {
    showTurboToast: (rate: 1 | 2 | 4, opts?: { label?: string; ms?: number }) => void;
};

const TurboToastCtx = createContext<Ctx | null>(null);

export function useTurboToast() {
    const ctx = useContext(TurboToastCtx);
    if (!ctx) throw new Error("useTurboToast must be used within TurboToastProvider");
    return ctx;
}

export function TurboToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastState>({ visible: false, rate: 1, id: 0 });
    const labelRef = useRef<string | null>(null);
    const timerRef = useRef<number | null>(null);

    const api = useMemo<Ctx>(
        () => ({
            showTurboToast: (rate, opts) => {
                labelRef.current = opts?.label ?? null;

                if (timerRef.current) window.clearTimeout(timerRef.current);

                setToast((prev) => ({
                    visible: true,
                    rate,
                    id: prev.id + 1,
                }));

                const ms = opts?.ms ?? 900;
                timerRef.current = window.setTimeout(() => {
                    setToast((prev) => ({ ...prev, visible: false }));
                    timerRef.current = null;
                }, ms);
            },
        }),
        []
    );

    return (
        <TurboToastCtx.Provider value={api}>
            {children}

            {/* Overlay badge */}
            <div
                className={[
                    "pointer-events-none fixed right-5 top-5 z-60 transition-all duration-200",
                    toast.visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
                ].join(" ")}
                aria-live="polite"
            >
                <div
                    key={toast.id}
                    className={[
                        "pointer-events-none select-none rounded-full border px-4 py-2 text-sm font-semibold",
                        "bg-(--panel) border-(--border) text-(--text) shadow-(--shadow-2) retro-noise",
                    ].join(" ")}
                >
                    {labelRef.current ? (
                        <span className="text-(--muted) mr-2">{labelRef.current}</span>
                    ) : null}
                    <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-(--accent)" />
                        Turbo: {toast.rate}x
                    </span>
                </div>
            </div>
        </TurboToastCtx.Provider>
    );
}