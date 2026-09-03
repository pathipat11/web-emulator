"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
    "[data-autofocus]",
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useModalDialog<T extends HTMLElement>(
    open: boolean,
    onClose: () => void,
) {
    const dialogRef = useRef<T | null>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;

        const dialog = dialogRef.current;
        const previousFocus = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;

        document.body.style.overflow = "hidden";

        const focusFrame = window.requestAnimationFrame(() => {
            const initialTarget = dialog?.querySelector<HTMLElement>("[data-autofocus]")
                ?? dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
                ?? dialog;
            initialTarget?.focus();
        });

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onCloseRef.current();
                return;
            }

            if (event.key !== "Tab" || !dialog) return;

            const focusable = Array.from(
                dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
            ).filter((element) => !element.hasAttribute("disabled"));

            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && (active === first || !dialog.contains(active))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown);

        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [open]);

    return dialogRef;
}
