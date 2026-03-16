/**
 * DS ROM Library — IndexedDB store
 */

const DB_NAME = "ds_rom_library";
const STORE = "roms";
const DB_VERSION = 1;
const META_LIST_KEY = "ds:rom-library";

export type DsRomEntry = {
    romHash: string;
    name: string;
    size: number;
    addedAt: number;
    lastPlayedAt: number | null;
    coverDataUrl?: string;
};

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function putDsRomBytes(romHash: string, bytes: Uint8Array): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(bytes.buffer, romHash);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function getDsRomBytes(romHash: string): Promise<Uint8Array | null> {
    const db = await openDB();
    const result = await new Promise<ArrayBuffer | null>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(romHash);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return result ? new Uint8Array(result) : null;
}

async function deleteDsRomBytes(romHash: string): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(romHash);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

function readList(): DsRomEntry[] {
    try {
        const raw = localStorage.getItem(META_LIST_KEY);
        return raw ? (JSON.parse(raw) as DsRomEntry[]) : [];
    } catch {
        return [];
    }
}

function writeList(list: DsRomEntry[]) {
    localStorage.setItem(META_LIST_KEY, JSON.stringify(list));
}

export function getDsRomList(): DsRomEntry[] {
    return readList().sort(
        (a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0) || b.addedAt - a.addedAt,
    );
}

export function upsertDsRomEntry(entry: DsRomEntry) {
    const list = readList();
    const idx = list.findIndex((r) => r.romHash === entry.romHash);
    if (idx >= 0) list[idx] = { ...list[idx], ...entry };
    else list.push(entry);
    writeList(list);
}

export function touchDsLastPlayed(romHash: string) {
    const list = readList();
    const entry = list.find((r) => r.romHash === romHash);
    if (entry) {
        entry.lastPlayedAt = Date.now();
        writeList(list);
    }
}

export function setDsCoverArt(romHash: string, dataUrl: string) {
    const list = readList();
    const entry = list.find((r) => r.romHash === romHash);
    if (entry) {
        entry.coverDataUrl = dataUrl;
        writeList(list);
    }
}

function deleteDsRomEntry(romHash: string) {
    writeList(readList().filter((r) => r.romHash !== romHash));
}

export async function deleteDsRom(romHash: string) {
    deleteDsRomEntry(romHash);
    await deleteDsRomBytes(romHash);
}
