import type { DsButton } from "./input";

export type DsGamepadMapping = {
    buttons: Partial<Record<number, DsButton>>;
    axes?: {
        x?: { index: number; negative: DsButton; positive: DsButton };
        y?: { index: number; negative: DsButton; positive: DsButton };
        deadzone?: number;
    };
};

export const defaultDsGamepadMapping: DsGamepadMapping = {
    buttons: {
        0: "A",
        1: "B",
        2: "X",
        3: "Y",
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
