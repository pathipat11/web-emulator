import type { NesButton } from "./input";

export type NesGamepadMapping = {
    buttons: Partial<Record<number, NesButton>>;
    axes?: {
        x?: { index: number; negative: NesButton; positive: NesButton };
        y?: { index: number; negative: NesButton; positive: NesButton };
        deadzone?: number;
    };
};

export const defaultNesGamepadMapping: NesGamepadMapping = {
    buttons: {
        0: "A",
        1: "B",
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
