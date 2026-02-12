export type GbaButton =
    | "A"
    | "B"
    | "L"
    | "R"
    | "START"
    | "SELECT"
    | "UP"
    | "DOWN"
    | "LEFT"
    | "RIGHT";

export const defaultKeymap: Record<string, GbaButton> = {
    // arrows
    ArrowUp: "UP",
    ArrowDown: "DOWN",
    ArrowLeft: "LEFT",
    ArrowRight: "RIGHT",

    // main buttons
    KeyZ: "A",
    KeyX: "B",

    // shoulders
    KeyA: "L",
    KeyS: "R",

    // start/select
    Enter: "START",
    ShiftLeft: "SELECT",
    ShiftRight: "SELECT",
};