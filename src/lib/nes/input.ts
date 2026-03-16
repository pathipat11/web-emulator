export type NesButton =
    | "A"
    | "B"
    | "START"
    | "SELECT"
    | "UP"
    | "DOWN"
    | "LEFT"
    | "RIGHT";

export const defaultNesKeymap: Record<string, NesButton> = {
    ArrowUp: "UP",
    ArrowDown: "DOWN",
    ArrowLeft: "LEFT",
    ArrowRight: "RIGHT",
    KeyZ: "A",
    KeyX: "B",
    Enter: "START",
    ShiftLeft: "SELECT",
    ShiftRight: "SELECT",
};
