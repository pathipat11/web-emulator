/**
 * ROM Library — IndexedDB store
 *
 * Stores ROM bytes in IndexedDB (no size limit unlike localStorage)
 * and metadata (romHash, name, size, timestamps) in localStorage
 * for fast list reads without opening IDB every time.
 */

const DB_NAME = "gba_rom_library";
const STORE = "roms";
const DB_VERSION = 1;
const META_LIST_KEY = "gba:rom-library";

/* ─── Types ─── */

export type RomEntry = {
    romHash: string;
    name: string;
    size: number;       // bytes
    addedAt: number;    // epoch ms
    lastPlayedAt: number | null;
    /** base64 data-url of last screenshot (optional cover art) */
    coverDataUrl?: string;
};

/* ─── IndexedDB helpers ─── */

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

/** Store ROM bytes keyed by romHash */
export async function putRomBytes(romHash: string, bytes: Uint8Array): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(bytes.buffer, romHash);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

/** Retrieve ROM bytes by hash. Returns null if not found. */
export async function getRomBytes(romHash: string): Promise<Uint8Array | null> {
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

/** Delete ROM bytes from IndexedDB */
export async function deleteRomBytes(romHash: string): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(romHash);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

/* ─── Metadata (localStorage — fast reads) ─── */

function readList(): RomEntry[] {
    try {
        const raw = localStorage.getItem(META_LIST_KEY);
        return raw ? (JSON.parse(raw) as RomEntry[]) : [];
    } catch {
        return [];
    }
}

function writeList(list: RomEntry[]) {
    localStorage.setItem(META_LIST_KEY, JSON.stringify(list));
}

/** Get all ROM entries sorted by lastPlayedAt desc, then addedAt desc */
export function getRomList(): RomEntry[] {
    return readList().sort(
        (a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0) || b.addedAt - a.addedAt,
    );
}

/** Add or update a ROM entry */
export function upsertRomEntry(entry: RomEntry) {
    const list = readList();
    const idx = list.findIndex((r) => r.romHash === entry.romHash);
    if (idx >= 0) list[idx] = { ...list[idx], ...entry };
    else list.push(entry);
    writeList(list);
}

/** Mark a ROM as "just played" */
export function touchLastPlayed(romHash: string) {
    const list = readList();
    const entry = list.find((r) => r.romHash === romHash);
    if (entry) {
        entry.lastPlayedAt = Date.now();
        writeList(list);
    }
}

/** Update cover art for a ROM */
export function setCoverArt(romHash: string, dataUrl: string) {
    const list = readList();
    const entry = list.find((r) => r.romHash === romHash);
    if (entry) {
        entry.coverDataUrl = dataUrl;
        writeList(list);
    }
}

/** Delete a ROM entry from the metadata list */
export function deleteRomEntry(romHash: string) {
    writeList(readList().filter((r) => r.romHash !== romHash));
}

/** Full delete: metadata + IndexedDB bytes */
export async function deleteRom(romHash: string) {
    deleteRomEntry(romHash);
    await deleteRomBytes(romHash);
}
