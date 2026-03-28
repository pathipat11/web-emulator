/**
 * Generic ROM Library factory — IndexedDB + localStorage
 *
 * Each system calls createRomStore() with its own DB name and
 * localStorage key prefix. Returns a full set of typed helpers.
 */

const STORE = "roms";
const DB_VERSION = 1;

export type RomEntry = {
    romHash: string;
    name: string;
    size: number;
    addedAt: number;
    lastPlayedAt: number | null;
    coverDataUrl?: string;
};

export function createRomStore(dbName: string, metaListKey: string) {
    function openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName, DB_VERSION);
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

    async function putRomBytes(romHash: string, bytes: Uint8Array): Promise<void> {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).put(bytes.buffer, romHash);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    }

    async function getRomBytes(romHash: string): Promise<Uint8Array | null> {
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

    async function deleteRomBytes(romHash: string): Promise<void> {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).delete(romHash);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    }

    function readList(): RomEntry[] {
        try {
            const raw = localStorage.getItem(metaListKey);
            return raw ? (JSON.parse(raw) as RomEntry[]) : [];
        } catch {
            return [];
        }
    }

    function writeList(list: RomEntry[]) {
        localStorage.setItem(metaListKey, JSON.stringify(list));
    }

    function getRomList(): RomEntry[] {
        return readList().sort(
            (a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0) || b.addedAt - a.addedAt,
        );
    }

    function upsertRomEntry(entry: RomEntry) {
        const list = readList();
        const idx = list.findIndex((r) => r.romHash === entry.romHash);
        if (idx >= 0) list[idx] = { ...list[idx], ...entry };
        else list.push(entry);
        writeList(list);
    }

    function touchLastPlayed(romHash: string) {
        const list = readList();
        const entry = list.find((r) => r.romHash === romHash);
        if (entry) {
            entry.lastPlayedAt = Date.now();
            writeList(list);
        }
    }

    function setCoverArt(romHash: string, dataUrl: string) {
        const list = readList();
        const entry = list.find((r) => r.romHash === romHash);
        if (entry) {
            entry.coverDataUrl = dataUrl;
            writeList(list);
        }
    }

    function deleteRomEntry(romHash: string) {
        writeList(readList().filter((r) => r.romHash !== romHash));
    }

    async function deleteRom(romHash: string) {
        deleteRomEntry(romHash);
        await deleteRomBytes(romHash);
    }

    return {
        putRomBytes,
        getRomBytes,
        deleteRomBytes,
        getRomList,
        upsertRomEntry,
        touchLastPlayed,
        setCoverArt,
        deleteRomEntry,
        deleteRom,
    };
}
