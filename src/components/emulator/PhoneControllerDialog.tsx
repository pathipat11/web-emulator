"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { useModalDialog } from "@/lib/hooks/useModalDialog";
import type { PhoneControllerState } from "@/lib/hooks/usePhoneController";

export function PhoneControllerDialog({
    open,
    systemLabel,
    state,
    onClose,
    onStart,
    onStop,
}: {
    open: boolean;
    systemLabel: string;
    state: PhoneControllerState;
    onClose: () => void;
    onStart: () => void;
    onStop: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const dialogRef = useModalDialog<HTMLElement>(open, onClose);

    if (!open) return null;

    const isLocalhost = state.pairingUrl
        ? new URL(state.pairingUrl).hostname === "localhost" ||
            new URL(state.pairingUrl).hostname === "127.0.0.1"
        : false;

    async function copyPairingLink() {
        if (!state.pairingUrl) return;
        try {
            await navigator.clipboard.writeText(state.pairingUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_500);
        } catch {
            // Clipboard access can be blocked on non-secure LAN origins.
        }
    }

    return (
        <div className="fixed inset-0 z-60 grid place-items-center p-4" role="presentation">
            <button
                type="button"
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close phone controller"
            />

            <section
                ref={dialogRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="phone-controller-title"
                className="relative z-10 w-full max-w-md rounded-2xl border border-(--border) bg-(--panel) p-5 shadow-(--shadow-2)"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-(--accent)">
                            {systemLabel}
                        </div>
                        <h2 id="phone-controller-title" className="mt-1 text-xl font-black">
                            Phone Controller
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-(--border) text-(--muted) transition hover:bg-(--panel-2) hover:text-(--text)"
                        aria-label="Close phone controller"
                    >
                        <span aria-hidden="true">✕</span>
                    </button>
                </div>

                <div className="mt-5 text-center">
                    {state.status === "waiting" && state.pairingUrl ? (
                        <>
                            <div className="mx-auto w-fit rounded-2xl bg-white p-3">
                                <QRCodeSVG
                                    value={state.pairingUrl}
                                    size={184}
                                    level="M"
                                    title="Phone controller pairing QR code"
                                />
                            </div>
                            <div className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-(--muted)">
                                Pairing code
                            </div>
                            <div className="mt-1 font-mono text-3xl font-black tracking-[0.22em] text-(--text)">
                                {state.code}
                            </div>
                        </>
                    ) : state.status === "connected" ? (
                        <div className="rounded-2xl border border-(--success-border) bg-(--success-soft) px-4 py-8">
                            <div className="mx-auto h-3 w-3 rounded-full bg-(--success)" />
                            <div className="mt-3 text-lg font-black text-(--success)">
                                Connected
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-(--border) bg-(--panel-2) px-4 py-8">
                            <div className="text-sm font-bold text-(--text)">
                                {state.status === "creating"
                                    ? "Creating pairing session..."
                                    : state.status === "error"
                                        ? "Connection unavailable"
                                        : "Use your phone as a controller"}
                            </div>
                        </div>
                    )}

                    <p className="mt-4 text-xs leading-relaxed text-(--muted)" role="status">
                        {state.message}
                    </p>

                    {isLocalhost && (
                        <p className="mt-3 rounded-xl border border-(--warning) px-3 py-2 text-left text-xs text-(--warning)">
                            This link uses localhost. Open the emulator through your
                            computer&apos;s LAN address before scanning from another device.
                        </p>
                    )}
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    {state.status === "waiting" && (
                        <>
                            <a
                                href={state.pairingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-(--border) px-4 py-2 text-xs font-bold text-(--muted) transition hover:text-(--text)"
                            >
                                Open controller
                            </a>
                            <button
                                type="button"
                                onClick={() => void copyPairingLink()}
                                className="rounded-xl border border-(--border) px-4 py-2 text-xs font-bold text-(--muted) transition hover:text-(--text)"
                            >
                                {copied ? "Copied" : "Copy link"}
                            </button>
                        </>
                    )}
                    {state.status === "idle" || state.status === "error" ? (
                        <button
                            type="button"
                            onClick={onStart}
                            data-autofocus
                            className="rounded-xl bg-(--accent) px-4 py-2 text-xs font-bold text-(--accent-text) transition hover:brightness-105"
                        >
                            {state.status === "error" ? "Try again" : "Create pairing code"}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onStop}
                            className="rounded-xl border border-(--danger) px-4 py-2 text-xs font-bold text-(--danger) transition hover:bg-(--panel-2)"
                        >
                            Disconnect
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
}
