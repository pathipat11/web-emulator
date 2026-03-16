"use client";

import { useEffect, useRef } from "react";

type Props = {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false,
    onConfirm,
    onCancel,
}: Props) {
    const confirmRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) confirmRef.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/40 transition-opacity" onClick={onCancel} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="w-full max-w-sm rounded-(--radius) border bg-(--panel) border-(--border) p-5 shadow-(--shadow-2)"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="nes-confirm-title"
                    aria-describedby="nes-confirm-msg"
                >
                    <div id="nes-confirm-title" className="text-base font-semibold">{title}</div>
                    <div id="nes-confirm-msg" className="mt-2 text-sm text-(--muted) leading-relaxed">{message}</div>
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-xl border border-(--border) px-4 py-2 text-sm text-(--muted) hover:text-(--text) transition"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            ref={confirmRef}
                            type="button"
                            onClick={onConfirm}
                            className={[
                                "rounded-xl border px-4 py-2 text-sm font-medium text-white transition active:translate-y-px",
                                danger
                                    ? "border-red-500 bg-red-500 hover:bg-red-600"
                                    : "border-(--border) bg-(--accent) hover:brightness-110",
                            ].join(" ")}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
