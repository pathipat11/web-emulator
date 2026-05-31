---
name: add-emulator-system
description: Step-by-step guide for adding a new emulator system (e.g. SNES, Game Boy) to Web Emulator Lab, wiring it into the shared generic hooks, storage factory, and routing.
---

# Adding a New Emulator System

This project supports multiple retro systems behind a shared architecture. Two patterns
exist:

1. **Custom core adapter** (GBA, NES) — a typed adapter wraps a JS/WASM emulator core and
   the React layer drives it through generic input hooks. Use this when you have a real
   library or WASM build to integrate.
2. **EmulatorJS iframe** (DS) — no adapter; an HTML doc loads EmulatorJS from CDN in a
   sandboxed `<iframe>`. Use this for quick support of a system EmulatorJS already covers.

Pick the pattern first. The steps below cover the **custom core adapter** path, which is
the more involved one. For the iframe path, copy `src/components/ds/` and adjust
`EJS_core`, the file extension, and the storage prefix.

Throughout, replace `xyz` / `Xyz` / `XYZ` with your system's short name (e.g. `snes`,
`Snes`, `SNES`).

## Prerequisites

- Read `AGENTS.md` first for conventions (path alias, 4-space indent, theme tokens,
  `"use client"`, async save-state APIs).
- Confirm the emulator core: a published npm package, or a WASM build you'll drop into
  `public/xyz/`.
- After every step run `npm run build` to keep TypeScript clean. There is no test suite.

## Step 1 — Define input types

Create `src/lib/xyz/input.ts`:

```ts
export type XyzButton = "A" | "B" | /* ...system buttons... */ "UP" | "DOWN" | "LEFT" | "RIGHT";

export const defaultXyzKeymap: Record<string, XyzButton> = {
    ArrowUp: "UP",
    ArrowDown: "DOWN",
    ArrowLeft: "LEFT",
    ArrowRight: "RIGHT",
    KeyZ: "A",
    KeyX: "B",
    Enter: "START",
    ShiftLeft: "SELECT",
    ShiftRight: "SELECT",
    // ...add system-specific keys (e.g. shoulders) ...
};
```

Create `src/lib/xyz/gamepad.ts` mirroring `src/lib/gamepad.ts`, typed as
`GamepadMapping<XyzButton>` (import the shape from `@/lib/emulator-core`).

## Step 2 — Write the core adapter

Create `src/lib/xyz/core-adapter.ts` exporting an `XyzCore` interface and a factory
(`createXyzCore()`). The interface MUST structurally satisfy `EmulatorCore` from
`@/lib/emulator-core` (`status`, `press(btn)`, `release(btn)`) so the generic hooks accept
its ref. Model it on:

- `src/lib/gba/core-adapter.ts` — for a WASM Module with a virtual FS.
- `src/lib/nes/core-adapter.ts` — for a JS core driven by a `requestAnimationFrame` loop.

Include `attachCanvas`, `loadRom`, `start`, `pause`, `reset`, `setAudioEnabled`, and save
state methods. If integrating untyped JS, use a local `any` with a disable comment,
matching existing style. For UI work before the core is ready, add a `createXyzStubCore()`
like GBA's.

## Step 3 — Add storage

ROM library — create `src/lib/storage/xyzRomStore.ts` using the factory:

```ts
import { createRomStore, type RomEntry } from "./createRomStore";

export type XyzRomEntry = RomEntry;
const store = createRomStore("xyz_rom_library", "xyz:rom-library");

export const putXyzRomBytes = store.putRomBytes;
export const getXyzRomBytes = store.getRomBytes;
export const getXyzRomList = store.getRomList;
export const upsertXyzRomEntry = store.upsertRomEntry;
export const touchXyzLastPlayed = store.touchLastPlayed;
export const setXyzCoverArt = store.setCoverArt;
export const deleteXyzRom = store.deleteRom;
```

Save states — create `src/lib/storage/xyzSaveStateStore.ts` modeled on
`saveStateStore.ts` (raw bytes) or `nesSaveStateStore.ts` (JSON strings). Use a unique
IndexedDB name (`xyz_save_states`). **All exported functions must be async and awaited by
callers.** Skip this entirely if using the EmulatorJS iframe path.

## Step 4 — Build the components

Under `src/components/xyz/`, create at minimum:

- `XyzConsole.tsx` — canvas wrapper. Copy `NesConsole.tsx`/`GbaConsole.tsx`, set the
  correct `width`/`height` and `aspect-*` ratio, keep the `scanlines` + glow styling.
- `XyzPlayer.tsx` — the orchestrator. Copy `NesPlayer.tsx` as the closest template and:
  - Use the generic hooks (do NOT create per-system input hooks):
    ```ts
    const { keymap, setKey, resetToDefaults } = useKeymap<XyzButton>("xyz:keymap", defaultXyzKeymap);
    useKeyboardInput(coreRef, keymap);
    useGamepadInput(coreRef, defaultXyzGamepadMapping, setGamepadInfo);
    ```
  - Import `hashRom` from `@/lib/hashRom` — never inline it.
  - Keep the menu-hide feature: `menuHidden` state, the `F2` shortcut effect, the floating
    toggle button, and the centered layout classes (see NES/GBA players).
- `XyzRomLibrary.tsx`, `MobileControls.tsx`, `XyzSettingsPanel.tsx`,
  `XyzKeymapEditor.tsx` — copy from `nes/` and re-type to `XyzButton`. Use the shared
  `Keymap<XyzButton>` type from `@/lib/hooks/useKeymap`.
- `ConfirmDialog.tsx` — re-export the shared one:
  ```ts
  export { ConfirmDialog } from "@/components/ConfirmDialog";
  ```

Slot-status checks in the settings panel must run in `useEffect` + state (save-state APIs
are async) — never inline in render. Copy the pattern from `NesSettingsPanel.tsx`.

## Step 5 — Add the route

Create `src/app/xyz/page.tsx`:

```tsx
import XyzPlayer from "@/components/xyz/XyzPlayer";

export default function XyzPage() {
    return (
        <main className="min-h-screen bg-(--bg)">
            <div className="mx-auto max-w-7xl">
                <XyzPlayer />
            </div>
        </main>
    );
}
```

## Step 6 — Flip the home card

In `src/app/page.tsx`, find the system's entry in the `systems` array, set
`disabled: false`, and point `href` at `/xyz`. Add a card image to `public/images/` if
missing.

## Step 7 — Static assets (WASM cores only)

Drop core files into `public/xyz/` and load them via `locateFile`, mirroring
`src/lib/gba/mgba-loader.ts`. If the core needs `SharedArrayBuffer`, the COOP/COEP headers
in `next.config.ts` already cover all routes — do not remove them. If a core file is
large generated JS, add it to the ESLint ignore list in `eslint.config.mjs` like
`public/mgba/mgba.js`.

## Step 8 — Verify

```bash
npm run build   # must pass clean
npm run lint
```

Then manually: upload a ROM, confirm play / pause / reset / eject, save + reload + load a
state, rebind a key, test a gamepad, toggle the menu with F2, and check mobile controls in
a narrow viewport.

## Checklist

- [ ] `src/lib/xyz/input.ts` + `gamepad.ts`
- [ ] `src/lib/xyz/core-adapter.ts` satisfies `EmulatorCore`
- [ ] `xyzRomStore.ts` via `createRomStore` factory
- [ ] `xyzSaveStateStore.ts` async (or N/A for iframe path)
- [ ] Components in `src/components/xyz/` reuse generic hooks + `hashRom`
- [ ] Menu-hide (`F2` + centered layout) preserved in the player
- [ ] Route at `src/app/xyz/page.tsx`
- [ ] Home card enabled in `src/app/page.tsx`
- [ ] `npm run build` passes

## Known cleanup spots

- Nothing outstanding. All ROM library components now import `hashRom` from
  `@/lib/hashRom`; keep it that way in new components.
