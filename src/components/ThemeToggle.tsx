/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(t: Theme) {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
}

export default function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>("light");

    useEffect(() => {
        const saved = (localStorage.getItem("theme") as Theme | null) ?? null;

        // default: follow system
        const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
        const initial: Theme = saved ?? (systemDark ? "dark" : "light");

        setTheme(initial);
        applyTheme(initial);
    }, []);

    function toggle() {
        const next: Theme = theme === "dark" ? "light" : "dark";
        setTheme(next);
        applyTheme(next);
        localStorage.setItem("theme", next);
    }

    return (
        <button
            onClick={toggle}
            className="
                rounded-full border px-3 py-1 text-sm
                bg-(--panel) text-(--text) border-(--border)
                hover:-translate-y-px transition
            "
            aria-label="Toggle theme"
            title="Toggle theme"
        >
            {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
        </button>
    );
}