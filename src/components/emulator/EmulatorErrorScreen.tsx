"use client";

import Link from "next/link";
import { useEffect } from "react";

type BoundaryError = Error & {
    digest?: string;
};

export function EmulatorErrorScreen({
    error,
    reset,
    systemName = "Web Emulator Lab",
    onReload,
}: {
    error: BoundaryError;
    reset: () => void;
    systemName?: string;
    onReload?: () => void;
}) {
    useEffect(() => {
        console.error(`${systemName} error boundary:`, error);
    }, [error, systemName]);

    const reload = onReload ?? (() => window.location.reload());

    return (
        <main className="grid min-h-dvh place-items-center bg-(--bg) p-4 text-(--text)">
            <section
                role="alert"
                aria-labelledby="emulator-error-title"
                className="w-full max-w-lg rounded-2xl border border-(--border) bg-(--panel) p-6 shadow-(--shadow-2)"
            >
                <div className="flex items-center gap-3">
                    <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-(--danger) bg-(--panel-2) text-xl font-black text-(--danger)"
                        aria-hidden="true"
                    >
                        !
                    </span>
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-(--accent)">
                            {systemName}
                        </div>
                        <h1
                            id="emulator-error-title"
                            className="mt-1 text-xl font-black"
                        >
                            Unable to continue
                        </h1>
                    </div>
                </div>

                <p className="mt-5 text-sm leading-relaxed text-(--muted)">
                    The emulator encountered an unexpected error. Your ROM library
                    and save states remain stored in this browser.
                </p>

                {error.digest && (
                    <p className="mt-3 font-mono text-[10px] text-(--muted)">
                        Reference: {error.digest}
                    </p>
                )}

                <div className="mt-6 grid gap-2 sm:grid-cols-3">
                    <button
                        type="button"
                        onClick={reset}
                        data-autofocus
                        className="rounded-xl bg-(--accent) px-4 py-2.5 text-sm font-bold text-(--accent-text)"
                    >
                        Try again
                    </button>
                    <button
                        type="button"
                        onClick={reload}
                        className="rounded-xl border border-(--border) px-4 py-2.5 text-sm font-bold text-(--text)"
                    >
                        Reload page
                    </button>
                    <Link
                        href="/"
                        className="rounded-xl border border-(--border) px-4 py-2.5 text-center text-sm font-bold text-(--muted)"
                    >
                        Back to systems
                    </Link>
                </div>
            </section>
        </main>
    );
}
