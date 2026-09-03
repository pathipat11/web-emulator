import type { ReactNode } from "react";

import ThemeToggle from "@/components/ThemeToggle";

function BrandMark() {
    return (
        <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-(--accent) text-(--accent-text) shadow-(--accent-shadow)">
            <svg aria-hidden="true" viewBox="0 0 32 32" className="h-6 w-6" fill="none">
                <path
                    d="M10.5 12h11a6.5 6.5 0 0 1 6.1 8.8l-1.1 2.8a2.4 2.4 0 0 1-4.1.6l-2-2.7h-8.8l-2 2.7a2.4 2.4 0 0 1-4.1-.6l-1.1-2.8a6.5 6.5 0 0 1 6.1-8.8Z"
                    stroke="currentColor"
                    strokeWidth="2"
                />
                <path d="M10 17h5M12.5 14.5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="21" cy="16" r="1.2" fill="currentColor" />
                <circle cx="24" cy="19" r="1.2" fill="currentColor" />
            </svg>
        </span>
    );
}

export function AppShell({
    eyebrow,
    title,
    description,
    status,
    children,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    status?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="min-h-screen bg-(--bg)">
            <header className="sticky top-0 z-30 border-b border-(--border) bg-(--bg-translucent) backdrop-blur-xl">
                <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <BrandMark />
                        <div className="min-w-0">
                            {eyebrow && (
                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--accent)">
                                    {eyebrow}
                                </div>
                            )}
                            <h1 className="truncate text-lg font-black tracking-tight sm:text-xl">{title}</h1>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {status}
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
                {description && (
                    <p className="mb-6 max-w-2xl text-sm leading-relaxed text-(--muted)">
                        {description}
                    </p>
                )}
                {children}
            </main>
        </div>
    );
}
