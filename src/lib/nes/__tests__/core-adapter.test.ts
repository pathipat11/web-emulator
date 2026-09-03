import { beforeEach, describe, expect, it, vi } from "vitest";

const jsnesMocks = vi.hoisted(() => ({
    loadROM: vi.fn(),
    reloadROM: vi.fn(),
    reset: vi.fn(),
    frame: vi.fn(),
    buttonDown: vi.fn(),
    buttonUp: vi.fn(),
}));

vi.mock("jsnes", () => ({
    NES: vi.fn(function MockNes() {
        return jsnesMocks;
    }),
}));

import { createJsnesCore } from "@/lib/nes/core-adapter";

describe("createJsnesCore reset", () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, "ImageData", {
            configurable: true,
            value: class ImageDataMock {
                data: Uint8ClampedArray;

                constructor(width: number, height: number) {
                    this.data = new Uint8ClampedArray(width * height * 4);
                }
            },
        });
        vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    });

    function createLoadedCore() {
        const core = createJsnesCore();
        const context = {
            imageSmoothingEnabled: true,
            putImageData: vi.fn(),
        };
        const canvas = {
            getContext: vi.fn(() => context),
        } as unknown as HTMLCanvasElement;

        core.attachCanvas(canvas);
        core.loadRom(new Uint8Array([1, 2, 3]));
        return core;
    }

    it("reloads the current ROM and resumes the frame loop", () => {
        const core = createLoadedCore();
        core.pause();
        core.reset();

        expect(jsnesMocks.reloadROM).toHaveBeenCalledOnce();
        expect(jsnesMocks.reset).not.toHaveBeenCalled();
        expect(core.status).toBe("running");
        expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    it("does not report running when reloading the ROM fails", () => {
        const core = createLoadedCore();
        core.pause();
        jsnesMocks.reloadROM.mockImplementationOnce(() => {
            throw new Error("reload failed");
        });

        expect(() => core.reset()).toThrow("reload failed");
        expect(core.status).toBe("paused");
    });
});
