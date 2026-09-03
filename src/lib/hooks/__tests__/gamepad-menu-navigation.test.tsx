import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useGamepadMenuNavigation } from "@/lib/hooks/useGamepadMenuNavigation";

type MutableGamepad = Omit<Gamepad, "buttons"> & {
    buttons: Array<{
        pressed: boolean;
        touched: boolean;
        value: number;
    }>;
};

function createGamepad(): MutableGamepad {
    return {
        axes: [0, 0],
        buttons: Array.from({ length: 16 }, () => ({
            pressed: false,
            touched: false,
            value: 0,
        })),
        connected: true,
        hapticActuators: [],
        id: "Xbox Wireless Controller",
        index: 0,
        mapping: "standard",
        timestamp: 0,
        vibrationActuator: null,
    } as unknown as MutableGamepad;
}

function MenuHarness({
    onSelect,
    onClose,
}: {
    onSelect: () => void;
    onClose: () => void;
}) {
    const menuRef = useRef<HTMLDivElement | null>(null);
    useGamepadMenuNavigation(true, menuRef, onClose);

    return (
        <div ref={menuRef}>
            <button type="button">First</button>
            <button type="button" onClick={onSelect}>Second</button>
        </div>
    );
}

const roots: Root[] = [];

function renderMenu(element: React.ReactNode) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);
    act(() => root.render(element));
    return container;
}

function installGamepadRuntime(gamepad: Gamepad) {
    let frame: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        frame = callback;
        return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: vi.fn(() => [gamepad]),
    });

    return () => {
        const callback = frame;
        if (callback) act(() => callback(performance.now()));
    };
}

afterEach(() => {
    while (roots.length) {
        const root = roots.pop();
        if (root) act(() => root.unmount());
    }
});

describe("useGamepadMenuNavigation", () => {
    it("moves focus with the D-pad and activates with the A button", () => {
        const gamepad = createGamepad();
        const runFrame = installGamepadRuntime(gamepad);
        const onSelect = vi.fn();
        const container = renderMenu(
            <MenuHarness onSelect={onSelect} onClose={vi.fn()} />,
        );
        const buttons = container.querySelectorAll<HTMLButtonElement>("button");
        buttons[0].focus();

        gamepad.buttons[13].pressed = true;
        runFrame();
        expect(document.activeElement).toBe(buttons[1]);

        gamepad.buttons[13].pressed = false;
        runFrame();
        gamepad.buttons[0].pressed = true;
        runFrame();
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("closes the menu with the B button", () => {
        const gamepad = createGamepad();
        const runFrame = installGamepadRuntime(gamepad);
        const onClose = vi.fn();
        renderMenu(<MenuHarness onSelect={vi.fn()} onClose={onClose} />);

        gamepad.buttons[1].pressed = true;
        runFrame();
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
