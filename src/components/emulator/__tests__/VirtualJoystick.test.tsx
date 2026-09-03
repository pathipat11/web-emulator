import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import {
    getJoystickDirections,
    VirtualJoystick,
} from "@/components/emulator/VirtualJoystick";

describe("getJoystickDirections", () => {
    it("ignores movement inside the deadzone", () => {
        expect(getJoystickDirections(0.2, -0.2)).toEqual([]);
    });

    it("maps cardinal directions", () => {
        expect(getJoystickDirections(-0.8, 0)).toEqual(["LEFT"]);
        expect(getJoystickDirections(0.8, 0)).toEqual(["RIGHT"]);
        expect(getJoystickDirections(0, -0.8)).toEqual(["UP"]);
        expect(getJoystickDirections(0, 0.8)).toEqual(["DOWN"]);
    });

    it("supports diagonal movement", () => {
        expect(getJoystickDirections(-0.8, -0.8)).toEqual(["LEFT", "UP"]);
        expect(getJoystickDirections(0.8, 0.8)).toEqual(["RIGHT", "DOWN"]);
    });

    it("releases active directions when the window loses focus", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);

        act(() => {
            root.render(
                <VirtualJoystick
                    onPress={onPress}
                    onRelease={onRelease}
                />,
            );
        });

        const joystick = container.querySelector<HTMLElement>(
            '[aria-label="Virtual joystick"]',
        );
        act(() => {
            joystick?.dispatchEvent(new KeyboardEvent("keydown", {
                key: "ArrowLeft",
                bubbles: true,
            }));
        });
        expect(onPress).toHaveBeenCalledWith("LEFT");

        act(() => window.dispatchEvent(new Event("blur")));
        expect(onRelease).toHaveBeenCalledWith("LEFT");

        act(() => root.unmount());
    });
});
