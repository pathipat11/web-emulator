import { describe, expect, it } from "vitest";

import {
    clampControlOpacity,
    clampControlPosition,
    clampControlScale,
    getDefaultPhoneControlPreferences,
    phoneControlStorageKey,
    readPhoneControlPreferences,
} from "@/lib/phone-controller/control-layout";

describe("phone controller layout", () => {
    it("keeps dragged controls inside the safe area", () => {
        expect(clampControlPosition({ x: -10, y: 120 })).toEqual({
            x: 6,
            y: 92,
        });
        expect(clampControlPosition({ x: 44, y: 55 })).toEqual({
            x: 44,
            y: 55,
        });
    });

    it("clamps global size and opacity preferences", () => {
        expect(clampControlScale(0.1)).toBe(0.7);
        expect(clampControlScale(2)).toBe(1.35);
        expect(clampControlOpacity(0.1)).toBe(0.45);
        expect(clampControlOpacity(2)).toBe(1);
    });

    it("loads and sanitizes a saved layout", () => {
        const key = phoneControlStorageKey("gba", "landscape");
        window.localStorage.setItem(key, JSON.stringify({
            positions: {
                A: { x: 150, y: -20 },
            },
            scale: 3,
            opacity: 0,
        }));

        const preferences = readPhoneControlPreferences("gba", "landscape");
        expect(preferences.positions.A).toEqual({ x: 94, y: 8 });
        expect(preferences.scale).toBe(1.35);
        expect(preferences.opacity).toBe(0.45);
        expect(preferences.positions.joystick).toEqual(
            getDefaultPhoneControlPreferences("landscape").positions.joystick,
        );
    });
});
