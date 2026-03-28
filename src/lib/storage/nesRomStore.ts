/**
 * NES ROM Library — backed by shared createRomStore factory
 */
import { createRomStore, type RomEntry } from "./createRomStore";

export type NesRomEntry = RomEntry;

const store = createRomStore("nes_rom_library", "nes:rom-library");

export const putNesRomBytes = store.putRomBytes;
export const getNesRomBytes = store.getRomBytes;
export const getNesRomList = store.getRomList;
export const upsertNesRomEntry = store.upsertRomEntry;
export const touchNesLastPlayed = store.touchLastPlayed;
export const setNesCoverArt = store.setCoverArt;
export const deleteNesRom = store.deleteRom;
