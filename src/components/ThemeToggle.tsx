/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function getInitialTheme(): ThemeMode {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
}

export default function ThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const [theme, setTheme] = useState<ThemeMode>("dark");

    useEffect(() => {
        const t = getInitialTheme();
        setTheme(t);
        document.documentElement.dataset.theme = t;
        setMounted(true);
    }, []);

    function toggle() {
        const next: ThemeMode = theme === "dark" ? "light" : "dark";
        setTheme(next);
        document.documentElement.dataset.theme = next;
        window.localStorage.setItem("theme", next);
    }

    if (!mounted) {
        return (
            <span className="inline-flex h-10 w-10 rounded-xl border border-(--border) bg-(--panel)" />
        );
    }

    return (
        <button
            onClick={toggle}
            className="grid h-10 w-10 place-items-center rounded-xl border border-(--border) bg-(--panel) text-(--text) transition hover:border-(--accent-border) hover:bg-(--panel-2)"
            title="Toggle theme"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            type="button"
        >
            {theme === "dark" ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none">
                    <path d="M20 15.1A8.5 8.5 0 0 1 8.9 4 8.5 8.5 0 1 0 20 15.1Z" stroke="currentColor" strokeWidth="1.8" />
                </svg>
            ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none">
                    <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            )}
        </button>
    );
}
