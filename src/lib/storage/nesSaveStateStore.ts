export type Slot = 1 | 2 | 3;

const KEY_PREFIX = "nes";

function key(romHash: string, slot: Slot) {
    return `${KEY_PREFIX}:state:${romHash}:slot:${slot}`;
}

function metaKey(romHash: string) {
    return `${KEY_PREFIX}:meta:${romHash}`;
}

export type NesSaveMeta = {
    romHash: string;
    romName: string;
    updatedAt: number;
    lastSlot?: Slot;
};

export function putNesSaveState(romHash: string, slot: Slot, jsonStr: string) {
    localStorage.setItem(key(romHash, slot), jsonStr);
}

export function getNesSaveState(romHash: string, slot: Slot): string | null {
    return localStorage.getItem(key(romHash, slot));
}

export function hasNesSaveState(romHash: string, slot: Slot) {
    return localStorage.getItem(key(romHash, slot)) != null;
}

export function putNesMeta(meta: NesSaveMeta) {
    localStorage.setItem(metaKey(meta.romHash), JSON.stringify(meta));
}

export function getNesMeta(romHash: string): NesSaveMeta | null {
    const raw = localStorage.getItem(metaKey(romHash));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as NesSaveMeta;
    } catch {
        return null;
    }
}
