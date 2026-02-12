import type { GbaButton } from "@/lib/input";

export type GamepadMapping = {
    buttons: Partial<Record<number, GbaButton>>;
    axes?: {
        x?: { index: number; negative: GbaButton; positive: GbaButton };
        y?: { index: number; negative: GbaButton; positive: GbaButton };
        deadzone?: number;
    };
};

export const defaultGamepadMapping: GamepadMapping = {
    buttons: {
        0: "A",
        1: "B",
        4: "L",
        5: "R",
        8: "SELECT",
        9: "START",

        12: "UP",
        13: "DOWN",
        14: "LEFT",
        15: "RIGHT",
    },
    axes: {
        x: { index: 0, negative: "LEFT", positive: "RIGHT" },
        y: { index: 1, negative: "UP", positive: "DOWN" },
        deadzone: 0.35,
    },
};