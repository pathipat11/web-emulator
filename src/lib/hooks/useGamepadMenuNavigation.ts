"use client";

import { useEffect, useRef } from "react";

type MenuState = {
    previous: boolean;
    next: boolean;
    select: boolean;
    back: boolean;
};

const MENU_CONTROL_SELECTOR = [
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[role='button'][tabindex]:not([aria-disabled='true'])",
].join(",");

export function useGamepadMenuNavigation(
    open: boolean,
    containerRef: React.RefObject<HTMLElement | null>,
    onClose: () => void,
) {
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;

        let animationFrame = 0;
        let previousState: MenuState = {
            previous: false,
            next: false,
            select: false,
            back: false,
        };

        const moveFocus = (direction: -1 | 1) => {
            const container = containerRef.current;
            if (!container) return;

            const controls = Array.from(
                container.querySelectorAll<HTMLElement>(MENU_CONTROL_SELECTOR),
            ).filter((element) => !element.hasAttribute("disabled"));
            if (controls.length === 0) return;

            const currentIndex = controls.findIndex(
                (element) => element === document.activeElement,
            );
            const baseIndex = currentIndex >= 0 ? currentIndex : 0;
            const nextIndex = (baseIndex + direction + controls.length) % controls.length;
            controls[nextIndex].focus();
        };

        const activateCurrent = () => {
            const container = containerRef.current;
            const active = document.activeElement;
            if (!container || !(active instanceof HTMLElement) || !container.contains(active)) {
                return;
            }
            active.click();
        };

        const tick = () => {
            const gamepads = navigator.getGamepads?.() ?? [];
            const gamepad = gamepads.find((candidate) => candidate?.connected) ?? null;

            if (gamepad) {
                const x = gamepad.axes?.[0] ?? 0;
                const y = gamepad.axes?.[1] ?? 0;
                const state: MenuState = {
                    previous:
                        !!gamepad.buttons?.[12]?.pressed ||
                        !!gamepad.buttons?.[14]?.pressed ||
                        y < -0.6 ||
                        x < -0.6,
                    next:
                        !!gamepad.buttons?.[13]?.pressed ||
                        !!gamepad.buttons?.[15]?.pressed ||
                        y > 0.6 ||
                        x > 0.6,
                    select: !!gamepad.buttons?.[0]?.pressed,
                    back: !!gamepad.buttons?.[1]?.pressed,
                };

                if (state.back && !previousState.back) {
                    onCloseRef.current();
                } else {
                    if (state.previous && !previousState.previous) moveFocus(-1);
                    if (state.next && !previousState.next) moveFocus(1);
                    if (state.select && !previousState.select) activateCurrent();
                }

                previousState = state;
            } else {
                previousState = {
                    previous: false,
                    next: false,
                    select: false,
                    back: false,
                };
            }

            animationFrame = window.requestAnimationFrame(tick);
        };

        animationFrame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(animationFrame);
    }, [containerRef, open]);
}
