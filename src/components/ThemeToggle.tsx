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
            <span className="inline-flex h-7.5 w-23 rounded-full border border-(--border) bg-(--panel)" />
        );
    }

    return (
        <button
            onClick={toggle}
            className="rounded-full border px-3 py-1 bg-(--panel) border-(--border) text-(--text) hover:-translate-y-px transition"
            title="Toggle theme"
            type="button"
        >
            {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
        </button>
    );
}