import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadMgbaFactoryMock } = vi.hoisted(() => ({
    loadMgbaFactoryMock: vi.fn(),
}));

vi.mock("@/lib/gba/mgba-loader", () => ({
    loadMgbaFactory: loadMgbaFactoryMock,
}));

import { createMgbaWasmCore } from "@/lib/gba/core-adapter";

type StoredFile = {
    bytes: Uint8Array;
    modifiedAt: number;
};

function createFakeModule() {
    const files = new Map<string, StoredFile>();
    const callOrder: string[] = [];
    let modifiedAt = 0;
    let romPath = "";
    let loadedState: Uint8Array | null = null;

    function statePath(slot: number) {
        const fileName = romPath.split("/").pop() ?? "game.gba";
        const baseName = fileName.replace(/\.[^/.]+$/, "");
        return `/data/states/${baseName}.ss${slot}`;
    }

    const fakeModule = {
        FS: {
            mkdir: vi.fn(),
            readdir: vi.fn((directory: string) => {
                const prefix = `${directory}/`;
                return [
                    ".",
                    "..",
                    ...Array.from(files.keys())
                        .filter((path) => path.startsWith(prefix))
                        .map((path) => path.slice(prefix.length)),
                ];
            }),
            readFile: vi.fn((path: string) => {
                const file = files.get(path);
                if (!file) throw new Error(`Missing file: ${path}`);
                return new Uint8Array(file.bytes);
            }),
            stat: vi.fn((path: string) => {
                const file = files.get(path);
                if (!file) throw new Error(`Missing file: ${path}`);
                return {
                    size: file.bytes.length,
                    mtime: new Date(file.modifiedAt),
                };
            }),
            writeFile: vi.fn((path: string, bytes: Uint8Array) => {
                modifiedAt += 1;
                files.set(path, {
                    bytes: new Uint8Array(bytes),
                    modifiedAt,
                });
            }),
        },
        FSInit: vi.fn(async () => {
            callOrder.push("FSInit");
        }),
        FSSync: vi.fn(async () => undefined),
        setCoreSettings: vi.fn(),
        loadGame: vi.fn((path: string) => {
            callOrder.push("loadGame");
            romPath = path;
            return true;
        }),
        saveState: vi.fn((slot: number) => {
            modifiedAt += 1;
            files.set(statePath(slot), {
                bytes: new Uint8Array([slot, modifiedAt]),
                modifiedAt,
            });
            return true;
        }),
        loadState: vi.fn((slot: number) => {
            const file = files.get(statePath(slot));
            if (!file) return false;
            loadedState = new Uint8Array(file.bytes);
            return true;
        }),
        quickReload: vi.fn(),
        resumeGame: vi.fn(),
        pauseGame: vi.fn(),
        pauseAudio: vi.fn(),
        resumeAudio: vi.fn(),
    };

    return {
        callOrder,
        fakeModule,
        getLoadedState: () => loadedState,
    };
}

describe("createMgbaWasmCore save states", () => {
    beforeEach(() => {
        loadMgbaFactoryMock.mockReset();
    });

    it("waits for the persistent filesystem before loading a ROM", async () => {
        const fake = createFakeModule();
        loadMgbaFactoryMock.mockResolvedValue(async () => fake.fakeModule);

        const core = await createMgbaWasmCore();
        core.attachCanvas(document.createElement("canvas"));
        await core.loadRom(new Uint8Array([1, 2, 3]), "game.gba");

        expect(fake.callOrder).toEqual(["FSInit", "loadGame"]);
        expect(fake.fakeModule.setCoreSettings).toHaveBeenCalledWith({
            autoSaveStateEnable: false,
            restoreAutoSaveStateOnLoad: false,
        });
    });

    it("returns bytes from the requested slot instead of another slot", async () => {
        const fake = createFakeModule();
        loadMgbaFactoryMock.mockResolvedValue(async () => fake.fakeModule);

        const core = await createMgbaWasmCore();
        core.attachCanvas(document.createElement("canvas"));
        await core.loadRom(new Uint8Array([1, 2, 3]), "game.gba");

        const slotOne = await core.saveStateBytes?.(1);
        const slotTwo = await core.saveStateBytes?.(2);

        expect(slotOne?.[0]).toBe(1);
        expect(slotTwo?.[0]).toBe(2);
    });

    it("writes portable bytes to the canonical slot before loading", async () => {
        const fake = createFakeModule();
        loadMgbaFactoryMock.mockResolvedValue(async () => fake.fakeModule);

        const core = await createMgbaWasmCore();
        core.attachCanvas(document.createElement("canvas"));
        await core.loadRom(new Uint8Array([1, 2, 3]), "game.gba");
        await core.loadStateBytes?.(2, new Uint8Array([9, 8, 7]));

        expect(fake.getLoadedState()).toEqual(new Uint8Array([9, 8, 7]));
    });

    it("reloads and resumes the ROM when resetting from a paused state", async () => {
        const fake = createFakeModule();
        loadMgbaFactoryMock.mockResolvedValue(async () => fake.fakeModule);

        const core = await createMgbaWasmCore();
        core.attachCanvas(document.createElement("canvas"));
        await core.loadRom(new Uint8Array([1, 2, 3]), "game.gba");
        core.pause();
        core.reset();

        expect(fake.fakeModule.quickReload).toHaveBeenCalledOnce();
        expect(fake.fakeModule.resumeGame).toHaveBeenCalledOnce();
        expect(core.status).toBe("running");
    });

    it("keeps the previous status when the mGBA reset API is unavailable", async () => {
        const fake = createFakeModule();
        const moduleWithoutReset = {
            ...fake.fakeModule,
            quickReload: undefined,
        };
        loadMgbaFactoryMock.mockResolvedValue(async () => moduleWithoutReset);

        const core = await createMgbaWasmCore();
        core.attachCanvas(document.createElement("canvas"));
        await core.loadRom(new Uint8Array([1, 2, 3]), "game.gba");
        core.pause();

        expect(() => core.reset()).toThrow("does not expose ROM reset");
        expect(core.status).toBe("paused");
    });
});
