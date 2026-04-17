/**
 * GBA Save State Store — IndexedDB backed
 *
 * Migrated from localStorage to IndexedDB to avoid the ~5-10 MB origin limit.
 * All public helpers are now async (returns Promises).
 */

export type Slot = 1 | 2 | 3;

export type SaveMeta = {
    romHash: string;
    romName: string;
    updatedAt: number; // epoch ms
    lastSlot?: Slot;
};

const DB_NAME = "gba_save_states";
const DB_VERSION = 1;
const STATE_STORE = "states"; // key = "romHash:slot"
const META_STORE = "meta";    // key = romHash

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

export async function putSaveState(romHash: string, slot: Slot, bytes: Uint8Array): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, "readwrite");
        tx.objectStore(STATE_STORE).put(bytes.buffer, stateKey(romHash, slot));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function getSaveState(romHash: string, slot: Slot): Promise<Uint8Array | null> {
    const db = await openDB();
    const result = await new Promise<ArrayBuffer | null>((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, "readonly");
        const req = tx.objectStore(STATE_STORE).get(stateKey(romHash, slot));
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return result ? new Uint8Array(result) : null;
}

export async function hasSaveState(romHash: string, slot: Slot): Promise<boolean> {
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

export async function deleteSaveState(romHash: string, slot: Slot): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STATE_STORE, "readwrite");
        tx.objectStore(STATE_STORE).delete(stateKey(romHash, slot));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function putMeta(meta: SaveMeta): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(META_STORE, "readwrite");
        tx.objectStore(META_STORE).put(meta, meta.romHash);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function getMeta(romHash: string): Promise<SaveMeta | null> {
    const db = await openDB();
    const result = await new Promise<SaveMeta | null>((resolve, reject) => {
        const tx = db.transaction(META_STORE, "readonly");
        const req = tx.objectStore(META_STORE).get(romHash);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
}
