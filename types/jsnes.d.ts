declare module "jsnes" {
    interface NESOptions {
        onFrame?: (frameBuffer: Int32Array) => void;
        onAudioSample?: (left: number, right: number) => void;
        onStatusUpdate?: (status: string) => void;
        onBatteryRamWrite?: (address: number, value: number) => void;
        emulateSound?: boolean;
        sampleRate?: number;
    }

    class NES {
        constructor(options?: NESOptions);
        loadROM(data: string): void;
        frame(): void;
        buttonDown(player: number, button: number): void;
        buttonUp(player: number, button: number): void;
        reset(): void;
        reloadROM(): void;
        getFPS(): number;
        setFramerate(rate: number): void;
        toJSON(): unknown;
        fromJSON(data: unknown): void;
    }

    namespace Controller {
        const BUTTON_A: number;
        const BUTTON_B: number;
        const BUTTON_SELECT: number;
        const BUTTON_START: number;
        const BUTTON_UP: number;
        const BUTTON_DOWN: number;
        const BUTTON_LEFT: number;
        const BUTTON_RIGHT: number;
    }
}
