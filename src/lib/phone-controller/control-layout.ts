import type { PhoneControllerSystem } from "@/lib/phone-controller/types";

export type PhoneControlOrientation = "landscape" | "portrait";

export type PhoneControlId =
    | "joystick"
    | "A"
    | "B"
    | "X"
    | "Y"
    | "L"
    | "R"
    | "START"
    | "SELECT";

export type PhoneControlPoint = {
    x: number;
    y: number;
};

export type PhoneControlPreferences = {
    positions: Record<PhoneControlId, PhoneControlPoint>;
    scale: number;
    opacity: number;
};

export const PHONE_SYSTEM_CONTROLS: Record<
    PhoneControllerSystem,
    {
        buttons: readonly string[];
        shoulders: readonly PhoneControlId[];
        faceButtons: readonly PhoneControlId[];
    }
> = {
    gba: {
        buttons: ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "L", "R", "START", "SELECT"],
        shoulders: ["L", "R"],
        faceButtons: ["B", "A"],
    },
    nes: {
        buttons: ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "START", "SELECT"],
        shoulders: [],
        faceButtons: ["B", "A"],
    },
};

const DEFAULT_POSITIONS: Record<
    PhoneControlOrientation,
    Record<PhoneControlId, PhoneControlPoint>
> = {
    landscape: {
        joystick: { x: 17, y: 58 },
        L: { x: 17, y: 17 },
        R: { x: 83, y: 17 },
        SELECT: { x: 45, y: 69 },
        START: { x: 55, y: 69 },
        B: { x: 79, y: 62 },
        A: { x: 89, y: 43 },
        X: { x: 79, y: 31 },
        Y: { x: 69, y: 43 },
    },
    portrait: {
        joystick: { x: 25, y: 64 },
        L: { x: 20, y: 22 },
        R: { x: 80, y: 22 },
        SELECT: { x: 43, y: 86 },
        START: { x: 57, y: 86 },
        B: { x: 71, y: 68 },
        A: { x: 85, y: 57 },
        X: { x: 71, y: 46 },
        Y: { x: 57, y: 57 },
    },
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function clampControlPosition(
    point: PhoneControlPoint,
    marginX = 6,
    marginY = 8,
): PhoneControlPoint {
    return {
        x: clamp(point.x, marginX, 100 - marginX),
        y: clamp(point.y, marginY, 100 - marginY),
    };
}

export function clampControlScale(value: number) {
    return clamp(value, 0.7, 1.35);
}

export function clampControlOpacity(value: number) {
    return clamp(value, 0.45, 1);
}

export function getDefaultPhoneControlPreferences(
    orientation: PhoneControlOrientation,
): PhoneControlPreferences {
    return {
        positions: Object.fromEntries(
            Object.entries(DEFAULT_POSITIONS[orientation]).map(
                ([id, point]) => [id, { ...point }],
            ),
        ) as Record<PhoneControlId, PhoneControlPoint>,
        scale: 1,
        opacity: 1,
    };
}

export function phoneControlStorageKey(
    system: PhoneControllerSystem,
    orientation: PhoneControlOrientation,
) {
    return `phone-controller:layout:v1:${system}:${orientation}`;
}

export function readPhoneControlPreferences(
    system: PhoneControllerSystem,
    orientation: PhoneControlOrientation,
): PhoneControlPreferences {
    const defaults = getDefaultPhoneControlPreferences(orientation);
    if (typeof window === "undefined") return defaults;

    try {
        const raw = window.localStorage.getItem(
            phoneControlStorageKey(system, orientation),
        );
        if (!raw) return defaults;
        const saved = JSON.parse(raw) as Partial<PhoneControlPreferences>;
        const positions = { ...defaults.positions };

        if (saved.positions && typeof saved.positions === "object") {
            for (const id of Object.keys(positions) as PhoneControlId[]) {
                const point = saved.positions[id];
                if (
                    point &&
                    Number.isFinite(point.x) &&
                    Number.isFinite(point.y)
                ) {
                    positions[id] = clampControlPosition(point);
                }
            }
        }

        return {
            positions,
            scale: Number.isFinite(saved.scale)
                ? clampControlScale(saved.scale as number)
                : defaults.scale,
            opacity: Number.isFinite(saved.opacity)
                ? clampControlOpacity(saved.opacity as number)
                : defaults.opacity,
        };
    } catch {
        return defaults;
    }
}

export function writePhoneControlPreferences(
    system: PhoneControllerSystem,
    orientation: PhoneControlOrientation,
    preferences: PhoneControlPreferences,
) {
    try {
        window.localStorage.setItem(
            phoneControlStorageKey(system, orientation),
            JSON.stringify(preferences),
        );
    } catch {
        // The controller remains usable when storage is unavailable.
    }
}
