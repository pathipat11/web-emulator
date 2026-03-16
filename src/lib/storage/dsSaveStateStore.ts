export type Slot = 1 | 2 | 3;

const KEY_PREFIX = "ds";

function key(romHash: string, slot: Slot) {
    return `${KEY_PREFIX}:state:${romHash}:slot:${slot}`;
}

function metaKey(romHash: string) {
    return `${KEY_PREFIX}:meta:${romHash}`;
}

export type DsSaveMeta = {
    romHash: string;
    romName: string;
    updatedAt: number;
    lastSlot?: Slot;
};

export function putDsSaveState(romHash: string, slot: Slot, data: string) {
    localStorage.setItem(key(romHash, slot), data);
}

export function getDsSaveState(romHash: string, slot: Slot): string | null {
    return localStorage.getItem(key(romHash, slot));
}

export function hasDsSaveState(romHash: string, slot: Slot) {
    return localStorage.getItem(key(romHash, slot)) != null;
}

export function putDsMeta(meta: DsSaveMeta) {
    localStorage.setItem(metaKey(meta.romHash), JSON.stringify(meta));
}

export function getDsMeta(romHash: string): DsSaveMeta | null {
    const raw = localStorage.getItem(metaKey(romHash));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as DsSaveMeta;
    } catch {
        return null;
    }
}
