/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GbaButton } from "@/lib/input";
import { loadMgbaFactory } from "./mgba-loader";

export type EmulatorStatus = "idle" | "running" | "paused";

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

export async function createMgbaWasmCore(): Promise<GbaCore> {
    let canvasEl: HTMLCanvasElement | null = null;
    let Module: any = null;
    let audioOn = true;

    const core: GbaCore = {
        status: "idle",

        attachCanvas(canvas) {
            canvasEl = canvas;
        },

        async loadRom(romBytes, fileName = "game.gba") {
            if (!canvasEl) throw new Error("Canvas not attached");

            const factory = await loadMgbaFactory();
            const moduleConfig: any = {
                canvas: canvasEl,
                locateFile: (path: string) => `/mgba/${path}`,
            };

            Module = await factory(moduleConfig);
            Module.FSInit();

            try { Module.FS.mkdir("/roms"); } catch { }
            const romPath = `/roms/${fileName}`;
            Module.FS.writeFile(romPath, romBytes);
            Module.loadGame(romPath, null);

            if (audioOn) Module.resumeAudio?.();
            else Module.pauseAudio?.();

            core.status = "running";
        },

        start() {
            if (!Module) return;
            Module.resumeGame?.();

            if (audioOn) Module.resumeAudio?.();
            else Module.pauseAudio?.();

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

            core.status = "running";
        },

        setAudioEnabled(enabled: boolean) {
            audioOn = enabled;
            if (!Module) return;
            if (enabled) Module.resumeAudio?.();
            else Module.pauseAudio?.();
        },

        press(btn) { if (!Module) return; Module.buttonPress?.(BTN_MAP[btn]); },
        release(btn) { if (!Module) return; Module.buttonUnpress?.(BTN_MAP[btn]); },

        async saveState(slot: number) { if (!Module) return; Module.saveState?.(slot); Module.FSSync?.(); },
        async loadState(slot: number) { if (!Module) return; Module.loadState?.(slot); },
    };

    return core;
}

/**
 * STUB core สำหรับให้โปรเจครัน UI ได้ก่อน
 * คุณจะเปลี่ยนตรงนี้เป็น core จริง (เช่น IodineGBA / mGBA WASM) ทีหลัง
 */
export function createStubCore(): GbaCore {
    let _canvas: HTMLCanvasElement | null = null;
    let _ctx: CanvasRenderingContext2D | null = null;

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

        async loadRom(_rom) {
            // no-op for stub
        },

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


        saveState: function (slot: number): Promise<void> {
            throw new Error("Function not implemented.");
        },
        loadState: function (slot: number): Promise<void> {
            throw new Error("Function not implemented.");
        }
    };

    return core;
}