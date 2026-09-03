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

    /** Get raw save-state bytes from the FS after saving */
    saveStateBytes?(slot: number): Promise<Uint8Array | null>;
    /** Write raw save-state bytes to the FS then load */
    loadStateBytes?(slot: number, bytes: Uint8Array): Promise<void>;

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
    let currentRomPath = "";

    // ✅ turbo state
    let turboRate: TurboRate = 1;
    let warnedTurbo = false;

    const STATE_DIR = "/data/states";

    function requireModule() {
        if (!Module) throw new Error("mGBA core is not loaded.");
        return Module;
    }

    function stateSuffix(slot: number) {
        return `.ss${slot}`;
    }

    function stateFilePaths(slot: number): string[] {
        const mgbaModule = requireModule();
        try {
            return mgbaModule.FS.readdir(STATE_DIR)
                .filter((name: string) => name !== "." && name !== "..")
                .filter((name: string) => name.toLowerCase().endsWith(stateSuffix(slot)))
                .map((name: string) => `${STATE_DIR}/${name}`);
        } catch {
            return [];
        }
    }

    function stateFileSignature(path: string): string {
        const mgbaModule = requireModule();
        const stat = mgbaModule.FS.stat(path);
        const mtime = stat.mtime instanceof Date
            ? stat.mtime.getTime()
            : Number(stat.mtime ?? 0);
        return `${Number(stat.size ?? 0)}:${mtime}`;
    }

    function snapshotStateFiles(slot: number): Map<string, string> {
        const snapshot = new Map<string, string>();
        for (const path of stateFilePaths(slot)) {
            try {
                snapshot.set(path, stateFileSignature(path));
            } catch {
                // The file may have disappeared between readdir and stat.
            }
        }
        return snapshot;
    }

    function expectedStatePaths(slot: number): string[] {
        const romFileName = currentRomPath.split("/").pop() ?? "";
        const romBaseName = romFileName.replace(/\.[^/.]+$/, "");
        return [
            `${STATE_DIR}/${romBaseName}${stateSuffix(slot)}`,
            `${STATE_DIR}/${romFileName}${stateSuffix(slot)}`,
        ];
    }

    function findStatePath(slot: number, before: Map<string, string>): string | null {
        const after = stateFilePaths(slot);
        const changed = after.filter((path) => {
            try {
                return before.get(path) !== stateFileSignature(path);
            } catch {
                return false;
            }
        });
        const expected = expectedStatePaths(slot);

        const changedExpected = expected.find((path) => changed.includes(path));
        if (changedExpected) return changedExpected;
        if (changed.length === 1) return changed[0];

        const existingExpected = expected.find((path) => after.includes(path));
        if (existingExpected) return existingExpected;

        return null;
    }

    async function syncStateFs() {
        const mgbaModule = requireModule();
        if (typeof mgbaModule.FSSync === "function") {
            await mgbaModule.FSSync();
            return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 150));
    }

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

            await Module.FSInit();

            // The app owns save-state persistence and auto-load behavior. Disable
            // mGBA's separate auto-state system so quickReload performs a clean
            // ROM reset instead of restoring its latest internal auto save.
            Module.setCoreSettings?.({
                autoSaveStateEnable: false,
                restoreAutoSaveStateOnLoad: false,
            });

            try {
                Module.FS.mkdir("/roms");
            } catch {
                // ignore
            }
            const romPath = `/roms/${fileName}`;
            currentRomPath = romPath;
            Module.FS.writeFile(romPath, romBytes);
            const loaded = Module.loadGame(romPath, null);
            if (loaded === false) {
                throw new Error(`mGBA could not load ROM: ${fileName}`);
            }

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

            // ✅ apply turbo after resume (some builds reset speed on resume)
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
            const mgbaModule = requireModule();
            if (typeof mgbaModule.quickReload !== "function") {
                throw new Error("This mGBA build does not expose ROM reset.");
            }

            mgbaModule.quickReload();
            // quickReload resets the ROM but does not guarantee that a paused
            // Emscripten main loop resumes.
            mgbaModule.resumeGame?.();

            if (audioOn) mgbaModule.resumeAudio?.();
            else mgbaModule.pauseAudio?.();

            // ✅ apply turbo after reset
            applyTurboToModule(mgbaModule, turboRate);

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
            const mgbaModule = requireModule();
            if (typeof mgbaModule.saveState !== "function") {
                throw new Error("This mGBA build does not expose save states.");
            }
            if (mgbaModule.saveState(slot) === false) {
                throw new Error(`mGBA failed to save slot ${slot}.`);
            }
        },

        async loadState(slot: number) {
            const mgbaModule = requireModule();
            if (typeof mgbaModule.loadState !== "function") {
                throw new Error("This mGBA build does not expose save states.");
            }
            if (mgbaModule.loadState(slot) === false) {
                throw new Error(`No valid mGBA save state was found in slot ${slot}.`);
            }

            // ✅ (optional) re-apply turbo after loadState (some builds reset speed)
            applyTurboToModule(mgbaModule, turboRate);
        },

        async saveStateBytes(slot: number): Promise<Uint8Array | null> {
            const mgbaModule = requireModule();
            try {
                const before = snapshotStateFiles(slot);
                await core.saveState(slot);
                await syncStateFs();

                const path = findStatePath(slot, before);
                if (!path) {
                    console.warn(`[mGBA] Could not identify the state file for slot ${slot}.`);
                    return null;
                }

                const data: Uint8Array = mgbaModule.FS.readFile(path);
                if (data.length === 0) {
                    throw new Error(`mGBA produced an empty save state for slot ${slot}.`);
                }
                return new Uint8Array(data);
            } catch (error) {
                console.error("[mGBA] saveStateBytes error:", error);
                if (error instanceof Error) throw error;
                throw new Error(String(error));
            }
        },

        async loadStateBytes(slot: number, bytes: Uint8Array): Promise<void> {
            const mgbaModule = requireModule();
            if (bytes.length === 0) {
                throw new Error(`Save state slot ${slot} is empty.`);
            }

            try {
                try { mgbaModule.FS.mkdir("/data"); } catch { /* exists */ }
                try { mgbaModule.FS.mkdir(STATE_DIR); } catch { /* exists */ }

                // Ask mGBA to create/update its canonical path for this ROM+slot,
                // then replace only that exact file with the portable state.
                const before = snapshotStateFiles(slot);
                await core.saveState(slot);
                await syncStateFs();

                const targetPath = findStatePath(slot, before);
                if (!targetPath) {
                    throw new Error(`Could not identify the mGBA state file for slot ${slot}.`);
                }

                mgbaModule.FS.writeFile(targetPath, bytes);
                await syncStateFs();
                await core.loadState(slot);
            } catch (error) {
                console.error("[mGBA] loadStateBytes failed:", error);
                if (error instanceof Error) throw error;
                throw new Error(String(error));
            }
        },
    };

    return core;
}

/**
 * STUB core for running the UI without a real emulator backend
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
