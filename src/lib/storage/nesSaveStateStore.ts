/**
 * NES Save State Store — IndexedDB backed
 *
 * NES saves are JSON strings (from jsnes). We store them as-is in IndexedDB.
 */

export type Slot = 1 | 2 | 3;

export type NesSaveMeta = {
    romHash: string;
    romName: string;
    updatedAt: number;
    lastSlot?: Slot;
};

const DB_NAME = "nes_save_states";
const DB_VERSION = 1;
const STATE_STORE = "states";
const META_STORE = "meta";

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STATE_STORE)) {
                db.createObjectStore(STATE_STORE);
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function stateKey(romHash: string, slot: Slot): string {
    return `${romHash}:${slot}`;
}

export async function putNesSaveState(romHash: string, slot: Slot, jsonStr: string): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, "readwrite");
        tx.objectStore(STATE_STORE).put(jsonStr, stateKey(romHash, slot));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function getNesSaveState(romHash: string, slot: Slot): Promise<string | null> {
    const db = await openDB();
    const result = await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, "readonly");
        const req = tx.objectStore(STATE_STORE).get(stateKey(romHash, slot));
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
}

export async function hasNesSaveState(romHash: string, slot: Slot): Promise<boolean> {
    const db = await openDB();
    const result = await new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, "readonly");
        const req = tx.objectStore(STATE_STORE).count(IDBKeyRange.only(stateKey(romHash, slot)));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return result > 0;
}

export async function putNesMeta(meta: NesSaveMeta): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(META_STORE, "readwrite");
        tx.objectStore(META_STORE).put(meta, meta.romHash);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function getNesMeta(romHash: string): Promise<NesSaveMeta | null> {
    const db = await openDB();
    const result = await new Promise<NesSaveMeta | null>((resolve, reject) => {
        const tx = db.transaction(META_STORE, "readonly");
        const req = tx.objectStore(META_STORE).get(romHash);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
}
