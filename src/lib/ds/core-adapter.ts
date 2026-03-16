/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DsButton } from "./input";

export type EmulatorStatus = "idle" | "running" | "paused";

export interface DsCore {
    status: EmulatorStatus;
    attachCanvas(topCanvas: HTMLCanvasElement, bottomCanvas: HTMLCanvasElement): void;
    loadRom(rom: Uint8Array, fileName?: string): Promise<void>;
    start(): void;
    pause(): void;
    reset(): void;
    press(btn: DsButton): void;
    release(btn: DsButton): void;
    saveState(): string | null;
    loadState(data: string): void;
    setAudioEnabled?(enabled: boolean): void;
    handleTouchStart(x: number, y: number): void;
    handleTouchMove(x: number, y: number): void;
    handleTouchEnd(): void;
    destroy(): void;
}

/**
 * Create a DS core that uses EmulatorJS via an iframe.
 *
 * EmulatorJS docs recommend iframe for React/SPA integration.
 * The ROM is passed as a blob URL to the iframe.
 */
export async function createDesmumeCore(): Promise<DsCore> {
    let iframeEl: HTMLIFrameElement | null = null;
    let containerEl: HTMLElement | null = null;
    let romBlobUrl: string | null = null;

    const core: DsCore = {
        status: "idle",

        attachCanvas(_top, bottom) {
            // We use the bottom canvas's parent as the container for the iframe
            containerEl = bottom.parentElement?.parentElement?.parentElement ?? null;
        },

        async loadRom(romBytes, fileName) {
            // Clean up previous iframe
            if (iframeEl) {
                iframeEl.remove();
                iframeEl = null;
            }
            if (romBlobUrl) {
                URL.revokeObjectURL(romBlobUrl);
            }

            // Create blob URL for the ROM
            const ab = new ArrayBuffer(romBytes.byteLength);
            new Uint8Array(ab).set(romBytes);
            const blob = new Blob([ab], { type: "application/octet-stream" });
            romBlobUrl = URL.createObjectURL(blob);

            const gameName = fileName?.replace(/\.[^/.]+$/, "") ?? "game";

            // Build the iframe HTML that loads EmulatorJS
            const html = buildEmulatorHTML(romBlobUrl, gameName);
            const htmlBlob = new Blob([html], { type: "text/html" });
            const htmlUrl = URL.createObjectURL(htmlBlob);

            // Create and insert iframe
            iframeEl = document.createElement("iframe");
            iframeEl.src = htmlUrl;
            iframeEl.style.cssText = "width:100%;height:100%;border:none;display:block;background:#000;border-radius:16px;";
            iframeEl.allow = "autoplay; gamepad";
            iframeEl.title = `DS Emulator - ${gameName}`;

            if (containerEl) {
                // Replace the canvas container content with the iframe
                containerEl.innerHTML = "";
                containerEl.appendChild(iframeEl);
            }

            core.status = "running";
        },

        start() {
            core.status = "running";
        },

        pause() {
            core.status = "paused";
        },

        reset() {
            core.status = "running";
        },

        press(_btn) {
            // Input is handled by EmulatorJS inside the iframe
        },

        release(_btn) {
            // Input is handled by EmulatorJS inside the iframe
        },

        saveState() {
            return null;
        },

        loadState(_data) {
            // EmulatorJS handles save states internally
        },

        setAudioEnabled(_enabled) {
            // EmulatorJS handles audio internally
        },

        handleTouchStart(_x, _y) {
            // Touch is handled by EmulatorJS inside the iframe
        },

        handleTouchMove(_x, _y) {
            // Touch is handled by EmulatorJS inside the iframe
        },

        handleTouchEnd() {
            // Touch is handled by EmulatorJS inside the iframe
        },

        destroy() {
            if (iframeEl) {
                iframeEl.remove();
                iframeEl = null;
            }
            if (romBlobUrl) {
                URL.revokeObjectURL(romBlobUrl);
                romBlobUrl = null;
            }
        },
    };

    return core;
}

function buildEmulatorHTML(romUrl: string, gameName: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body, html { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#000; }
  #game { width:100%; height:100%; }
</style>
</head>
<body>
<div id="game"></div>
<script>
  EJS_player = '#game';
  EJS_core = 'desmume2015';
  EJS_gameUrl = '${romUrl}';
  EJS_gameName = '${gameName.replace(/'/g, "\\'")}';
  EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
  EJS_startOnLoaded = true;
  EJS_color = '#1a1a2e';
  EJS_backgroundColor = '#000';
  EJS_Buttons = {
    cacheManager: false
  };
</script>
<script src="https://cdn.emulatorjs.org/stable/data/loader.js"><\/script>
</body>
</html>`;
}
