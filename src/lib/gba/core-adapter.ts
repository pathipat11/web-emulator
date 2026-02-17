/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GbaButton } from "@/lib/input";
import { loadMgbaFactory } from "./mgba-loader";

export type EmulatorStatus = "idle" | "running" | "paused";
export type TurboRate = 1 | 2 | 4;

export interface GbaCore {
    status: EmulatorStatus;
    attachCanvas(canvas: HTMLCanvasElement): void;

    loadRom(rom: Uint8Array, fileName?: string): Promise<void>;
    start(): void;
    pause(): void;
    reset(): void;

    press(btn: GbaButton): void;
    release(btn: GbaButton): void;

    saveState(slot: number): Promise<void>;
    loadState(slot: number): Promise<void>;

    setAudioEnabled?(enabled: boolean): void;

    /** ✅ Turbo: 1x / 2x / 4x */
    setTurbo?(rate: TurboRate): void;
    getTurbo?(): TurboRate;
}

const BTN_MAP: Record<GbaButton, string> = {
    A: "a",
    B: "b",
    L: "l",
    R: "r",
    START: "start",
    SELECT: "select",
    UP: "up",
    DOWN: "down",
    LEFT: "left",
    RIGHT: "right",
};

function safeCall(Module: any, fnName: string, ...args: any[]) {
    const fn = Module?.[fnName];
    if (typeof fn === "function") {
        fn(...args);
        return true;
    }
    return false;
}

/**
 * Apply turbo by probing common mGBA web exports.
 * Different builds expose different names, so we try multiple.
 */
function applyTurboToModule(Module: any, rate: TurboRate) {
    if (!Module) return false;

    const enable = rate > 1;

    // 1) Most direct / nicest APIs (if present)
    if (safeCall(Module, "setTurbo", rate)) return true;
    if (safeCall(Module, "setSpeedMultiplier", rate)) return true;
    if (safeCall(Module, "setEmulationSpeed", rate)) return true;

    // 2) Fast-forward style APIs
    if (safeCall(Module, "setFastForwardMultiplier", rate)) return true;
    if (safeCall(Module, "setFastForwardSpeed", rate)) return true;

    // Some builds separate enable/disable from multiplier
    // try setFastForward(true/false) then multiplier
    const ffEnabled =
        safeCall(Module, "setFastForward", enable) ||
        safeCall(Module, "setFastForwardEnabled", enable) ||
        safeCall(Module, "toggleFastForward", enable);

    if (ffEnabled) {
        // if enabled, try multiplier knobs (if any)
        safeCall(Module, "setFastForwardMultiplier", rate);
        safeCall(Module, "setSpeedMultiplier", rate);
        return true;
    }

    // 3) Last-resort: throttle/frameskip controls (not ideal, but sometimes exists)
    // - throttle 1 = normal, 0 = unthrottled (fast as possible)
    if (safeCall(Module, "setThrottle", enable ? 0 : 1)) return true;
    if (safeCall(Module, "setUnthrottled", enable)) return true;

    // - frame skip (roughly faster but choppy; only use if it exists)
    if (safeCall(Module, "setFrameSkip", enable ? 1 : 0)) return true;

    return false;
}

export async function createMgbaWasmCore(): Promise<GbaCore> {
    let canvasEl: HTMLCanvasElement | null = null;
    let Module: any = null;

    let audioOn = true;

    // ✅ turbo state
    let turboRate: TurboRate = 1;
    let warnedTurbo = false;

    const core: GbaCore = {
        status: "idle",

        attachCanvas(canvas) {
            canvasEl = canvas;
        },

        getTurbo() {
            return turboRate;
        },

        setTurbo(rate: TurboRate) {
            turboRate = rate;
            if (!Module) return;

            const ok = applyTurboToModule(Module, turboRate);
            if (!ok && !warnedTurbo) {
                warnedTurbo = true;
                console.warn(
                    "[mGBA] Turbo API not found on Module. Available keys:",
                    Object.keys(Module || {})
                );
                console.warn(
                    "[mGBA] Tip: expose Module to window and inspect: window.__mgba = Module"
                );
            }
        },

        async loadRom(romBytes, fileName = "game.gba") {
            if (!canvasEl) throw new Error("Canvas not attached");

            const factory = await loadMgbaFactory();
            const moduleConfig: any = {
                canvas: canvasEl,
                locateFile: (path: string) => `/mgba/${path}`,
            };

            Module = await factory(moduleConfig);

            // ✅ optional: expose for debugging in console
            (window as any).__mgba = Module;

            Module.FSInit();

            try {
                Module.FS.mkdir("/roms");
            } catch {
                // ignore
            }
            const romPath = `/roms/${fileName}`;
            Module.FS.writeFile(romPath, romBytes);
            Module.loadGame(romPath, null);

            // audio
            if (audioOn) Module.resumeAudio?.();
            else Module.pauseAudio?.();

            // ✅ apply turbo after game loaded
            applyTurboToModule(Module, turboRate);

            core.status = "running";
        },

        start() {
            if (!Module) return;
            Module.resumeGame?.();

            if (audioOn) Module.resumeAudio?.();
            else Module.pauseAudio?.();

            // ✅ apply turbo after resume (บาง build reset speed ตอน resume)
            applyTurboToModule(Module, turboRate);

            core.status = "running";
        },

        pause() {
            if (!Module) return;
            Module.pauseGame?.();
            Module.pauseAudio?.();
            core.status = "paused";
        },

        reset() {
            if (!Module) return;
            Module.quickReload?.();

            if (audioOn) Module.resumeAudio?.();
            else Module.pauseAudio?.();

            // ✅ apply turbo after reset
            applyTurboToModule(Module, turboRate);

            core.status = "running";
        },

        setAudioEnabled(enabled: boolean) {
            audioOn = enabled;
            if (!Module) return;
            if (enabled) Module.resumeAudio?.();
            else Module.pauseAudio?.();
        },

        press(btn) {
            if (!Module) return;
            Module.buttonPress?.(BTN_MAP[btn]);
        },

        release(btn) {
            if (!Module) return;
            Module.buttonUnpress?.(BTN_MAP[btn]);
        },

        async saveState(slot: number) {
            if (!Module) return;
            Module.saveState?.(slot);
            Module.FSSync?.();
        },

        async loadState(slot: number) {
            if (!Module) return;
            Module.loadState?.(slot);

            // ✅ (optional) re-apply turbo after loadState (บาง build reset speed)
            applyTurboToModule(Module, turboRate);
        },
    };

    return core;
}

/**
 * STUB core สำหรับให้โปรเจครัน UI ได้ก่อน
 */
export function createStubCore(): GbaCore {
    let _canvas: HTMLCanvasElement | null = null;
    let _ctx: CanvasRenderingContext2D | null = null;

    let turboRate: TurboRate = 1;

    const core: GbaCore = {
        status: "idle",

        attachCanvas(canvas) {
            _canvas = canvas;
            _ctx = canvas.getContext("2d");
            if (_ctx) {
                _ctx.imageSmoothingEnabled = false;
                _ctx.fillStyle = "#111";
                _ctx.fillRect(0, 0, canvas.width, canvas.height);
                _ctx.fillStyle = "#fff";
                _ctx.font = "16px monospace";
                _ctx.fillText("GBA core not connected yet.", 12, 28);
                _ctx.fillText("Plug in a WASM/JS core in core-adapter.ts", 12, 52);
            }
        },

        async loadRom(_rom) { },

        start() {
            core.status = "running";
        },

        pause() {
            core.status = "paused";
        },

        reset() {
            core.status = "idle";
        },

        press(_btn) { },
        release(_btn) { },

        async saveState(_slot: number) {
            throw new Error("Function not implemented.");
        },

        async loadState(_slot: number) {
            throw new Error("Function not implemented.");
        },

        getTurbo() {
            return turboRate;
        },

        setTurbo(rate: TurboRate) {
            turboRate = rate;
            // stub: no real effect
        },
    };

    return core;
}