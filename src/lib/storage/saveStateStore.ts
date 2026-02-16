export type Slot = 1 | 2 | 3;

const KEY_PREFIX = "gba";

function key(romHash: string, slot: Slot) {
    return `${KEY_PREFIX}:state:${romHash}:slot:${slot}`;
}

function metaKey(romHash: string) {
    return `${KEY_PREFIX}:meta:${romHash}`;
}

export type SaveMeta = {
    romHash: string;
    romName: string;
    updatedAt: number; // epoch ms
    lastSlot?: Slot;
};

export function putSaveState(romHash: string, slot: Slot, bytes: Uint8Array) {
    const b64 = btoa(String.fromCharCode(...bytes));
    localStorage.setItem(key(romHash, slot), b64);
}

export function getSaveState(romHash: string, slot: Slot): Uint8Array | null {
    const b64 = localStorage.getItem(key(romHash, slot));
    if (!b64) return null;

    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export function hasSaveState(romHash: string, slot: Slot) {
    return localStorage.getItem(key(romHash, slot)) != null;
}

export function putMeta(meta: SaveMeta) {
    localStorage.setItem(metaKey(meta.romHash), JSON.stringify(meta));
}

export function getMeta(romHash: string): SaveMeta | null {
    const raw = localStorage.getItem(metaKey(romHash));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as SaveMeta;
    } catch {
        return null;
    }
}