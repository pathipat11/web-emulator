import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EmulatorCore, GamepadMapping } from "@/lib/emulator-core";
import { useGamepadInput } from "@/lib/hooks/useGamepadInput";
import { useKeyboardInput } from "@/lib/hooks/useKeyboardInput";

type Button = "A" | "B" | "UP" | "SELECT";
type MutableGamepad = Omit<Gamepad, "buttons"> & {
    buttons: Array<{
        pressed: boolean;
        touched: boolean;
        value: number;
    }>;
};

function createCore(): EmulatorCore {
    return {
        status: "running",
        press: vi.fn(),
        release: vi.fn(),
    };
}

function KeyboardHarness({
    core,
    keymap,
    enabled = true,
}: {
    core: EmulatorCore;
    keymap: Record<string, Button>;
    enabled?: boolean;
}) {
    const coreRef = useRef<EmulatorCore | null>(core);
    useKeyboardInput(coreRef, keymap, enabled);
    return null;
}

function GamepadHarness({
    core,
    mapping,
    setInfo,
    enabled = true,
}: {
    core: EmulatorCore;
    mapping: GamepadMapping<Button>;
    setInfo: (info: string) => void;
    enabled?: boolean;
}) {
    const coreRef = useRef<EmulatorCore | null>(core);
    useGamepadInput(coreRef, mapping, setInfo, enabled);
    return null;
}

const roots: Root[] = [];

function render(element: React.ReactNode) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);
    act(() => root.render(element));
    return root;
}

afterEach(() => {
    while (roots.length) {
        const root = roots.pop();
        if (root) act(() => root.unmount());
    }
});

describe("useKeyboardInput", () => {
    it("releases active buttons when the window loses focus", () => {
        const core = createCore();
        render(<KeyboardHarness core={core} keymap={{ ArrowUp: "UP" }} />);

        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp" }));
        });
        expect(core.press).toHaveBeenCalledWith("UP");

        act(() => window.dispatchEvent(new Event("blur")));
        expect(core.release).toHaveBeenCalledWith("UP");
    });

    it("keeps a shared emulator button pressed until every mapped key is released", () => {
        const core = createCore();
        render(
            <KeyboardHarness
                core={core}
                keymap={{ ShiftLeft: "SELECT", ShiftRight: "SELECT" }}
            />,
        );

        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft" }));
            window.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftRight" }));
        });
        expect(core.press).toHaveBeenCalledTimes(1);

        act(() => {
            window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft" }));
        });
        expect(core.release).not.toHaveBeenCalled();

        act(() => {
            window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftRight" }));
        });
        expect(core.release).toHaveBeenCalledTimes(1);
        expect(core.release).toHaveBeenCalledWith("SELECT");
    });

    it("releases active buttons when keyboard input is disabled", () => {
        const core = createCore();
        const root = render(
            <KeyboardHarness core={core} keymap={{ KeyZ: "A" }} />,
        );

        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyZ" }));
        });
        expect(core.press).toHaveBeenCalledWith("A");

        act(() => {
            root.render(
                <KeyboardHarness core={core} keymap={{ KeyZ: "A" }} enabled={false} />,
            );
        });
        expect(core.release).toHaveBeenCalledWith("A");
    });
});

describe("useGamepadInput", () => {
    function createGamepad(): MutableGamepad {
        const buttons = Array.from({ length: 16 }, () => ({
            pressed: false,
            touched: false,
            value: 0,
        }));
        return {
            axes: [0, 0],
            buttons,
            connected: true,
            hapticActuators: [],
            id: "Xbox Wireless Controller",
            index: 0,
            mapping: "standard",
            timestamp: 0,
            vibrationActuator: null,
        } as unknown as MutableGamepad;
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

    function gamepadEvent(type: string, gamepad: Gamepad): Event {
        const event = new Event(type);
        Object.defineProperty(event, "gamepad", { value: gamepad });
        return event;
    }

    it("releases pressed buttons when the active controller disconnects", () => {
        const core = createCore();
        const gamepad = createGamepad();
        gamepad.buttons[0].pressed = true;
        gamepad.buttons[0].value = 1;
        const runFrame = installGamepadRuntime(gamepad);

        render(
            <GamepadHarness
                core={core}
                mapping={{ buttons: { 0: "A" } }}
                setInfo={vi.fn()}
            />,
        );
        runFrame();
        expect(core.press).toHaveBeenCalledWith("A");

        act(() => window.dispatchEvent(gamepadEvent("gamepaddisconnected", gamepad)));
        expect(core.release).toHaveBeenCalledWith("A");
    });

    it("does not release a shared button while another mapped input remains active", () => {
        const core = createCore();
        const gamepad = createGamepad();
        gamepad.buttons[0].pressed = true;
        gamepad.buttons[0].value = 1;
        gamepad.buttons[1].pressed = true;
        gamepad.buttons[1].value = 1;
        const runFrame = installGamepadRuntime(gamepad);

        render(
            <GamepadHarness
                core={core}
                mapping={{ buttons: { 0: "A", 1: "A" } }}
                setInfo={vi.fn()}
            />,
        );
        runFrame();
        expect(core.press).toHaveBeenCalledTimes(1);

        gamepad.buttons[0].pressed = false;
        gamepad.buttons[0].value = 0;
        runFrame();
        expect(core.release).not.toHaveBeenCalled();

        gamepad.buttons[1].pressed = false;
        gamepad.buttons[1].value = 0;
        runFrame();
        expect(core.release).toHaveBeenCalledTimes(1);
    });

    it("releases active buttons when gamepad input is disabled", () => {
        const core = createCore();
        const gamepad = createGamepad();
        gamepad.buttons[0].pressed = true;
        gamepad.buttons[0].value = 1;
        const runFrame = installGamepadRuntime(gamepad);
        const setInfo = vi.fn();
        const mapping: GamepadMapping<Button> = { buttons: { 0: "A" } };

        const root = render(
            <GamepadHarness core={core} mapping={mapping} setInfo={setInfo} />,
        );
        runFrame();
        expect(core.press).toHaveBeenCalledWith("A");

        act(() => {
            root.render(
                <GamepadHarness
                    core={core}
                    mapping={mapping}
                    setInfo={setInfo}
                    enabled={false}
                />,
            );
        });
        expect(core.release).toHaveBeenCalledWith("A");
    });
});
