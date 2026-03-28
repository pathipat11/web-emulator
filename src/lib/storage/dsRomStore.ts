/**
 * DS ROM Library — backed by shared createRomStore factory
 */
import { createRomStore, type RomEntry } from "./createRomStore";

export type DsRomEntry = RomEntry;

const store = createRomStore("ds_rom_library", "ds:rom-library");

export const putDsRomBytes = store.putRomBytes;
export const getDsRomBytes = store.getRomBytes;
export const getDsRomList = store.getRomList;
export const upsertDsRomEntry = store.upsertRomEntry;
export const touchDsLastPlayed = store.touchLastPlayed;
export const setDsCoverArt = store.setCoverArt;
export const deleteDsRom = store.deleteRom;
