export type DsButton =
    | "A"
    | "B"
    | "X"
    | "Y"
    | "L"
    | "R"
    | "START"
    | "SELECT"
    | "UP"
    | "DOWN"
    | "LEFT"
    | "RIGHT";

export const defaultDsKeymap: Record<string, DsButton> = {
    ArrowUp: "UP",
    ArrowDown: "DOWN",
    ArrowLeft: "LEFT",
    ArrowRight: "RIGHT",
    KeyZ: "A",
    KeyX: "B",
    KeyA: "Y",
    KeyS: "X",
    KeyQ: "L",
    KeyW: "R",
    Enter: "START",
    ShiftLeft: "SELECT",
    ShiftRight: "SELECT",
};
