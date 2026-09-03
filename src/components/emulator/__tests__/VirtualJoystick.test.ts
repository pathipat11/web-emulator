import { describe, expect, it } from "vitest";

import { getJoystickDirections } from "@/components/emulator/VirtualJoystick";

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
});
