/**
 * GBA ROM Library — backed by shared createRomStore factory
 */
import { createRomStore } from "./createRomStore";
export type { RomEntry } from "./createRomStore";

const store = createRomStore("gba_rom_library", "gba:rom-library");

export const putRomBytes = store.putRomBytes;
export const getRomBytes = store.getRomBytes;
export const deleteRomBytes = store.deleteRomBytes;
export const getRomList = store.getRomList;
export const upsertRomEntry = store.upsertRomEntry;
export const touchLastPlayed = store.touchLastPlayed;
export const setCoverArt = store.setCoverArt;
export const deleteRomEntry = store.deleteRomEntry;
export const deleteRom = store.deleteRom;
