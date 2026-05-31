# AGENTS.md

Guidance for AI agents working in this repository. Read this before making changes.

## Project Overview

**Web Emulator Lab** is a browser-based retro game emulator platform. Everything runs
client-side — ROMs are never uploaded to a server. Built with Next.js 16 (App Router),
React 19, Tailwind CSS 4, and TypeScript.

Supported systems:

| System | Core | ROM | Strategy |
| --- | --- | --- | --- |
| GBA | mGBA (WASM) | `.gba` | Custom core adapter |
| NES | JSNES | `.nes` | Custom core adapter |
| DS | EmulatorJS / DeSmuME | `.nds` | Sandboxed `<iframe>` + CDN |

SNES, Game Boy, and PS1 are stubbed as "Coming soon" on the home page.

## Commands

```bash
npm run dev      # Start dev server (do NOT run in agent automation — it blocks)
npm run build    # Production build — use this to verify changes compile
npm run start    # Serve production build
npm run lint     # ESLint
```

**Always run `npm run build` after making changes** to verify TypeScript and the
production bundle are clean. There is no test suite in this project.

## Conventions

- **Imports:** Use the `@/*` path alias (maps to `src/*`). Avoid long relative chains.
- **TypeScript:** `strict` mode is on. Avoid `any`; when a third-party core is genuinely
  untyped (mGBA Module, jsnes), narrow with a local `any` and a disable comment, matching
  the existing style.
- **Indentation:** 4 spaces, matching existing files.
- **Client components:** Anything touching the DOM, emulator core, or browser storage must
  start with `"use client"`.
- **Styling:** Tailwind 4 with CSS custom properties as theme tokens. Use the
  `bg-(--panel)`, `text-(--muted)`, `border-(--border)` token syntax — see
  `src/app/globals.css` for the full set. Do not hardcode colors.
- **No new dependencies** without a clear reason; prefer the existing stack.

## Architecture

### Core adapters

Each emulator is wrapped behind a typed adapter so the React layer stays
core-agnostic:

- **GBA** — `src/lib/gba/core-adapter.ts` exposes `GbaCore`, wrapping the mGBA WASM
  Module (virtual FS for ROM/state, button map, turbo, audio). Includes `createStubCore()`
  for UI work without the real binary.
- **NES** — `src/lib/nes/core-adapter.ts` exposes `NesCore`, wrapping JSNES with a
  `requestAnimationFrame` loop, `ImageData` rendering, and `ScriptProcessorNode` audio.
- **DS** — no adapter. `DsPlayer` builds an HTML doc that loads EmulatorJS from CDN and
  renders it in an `<iframe>`; the ROM is passed as a Blob URL.

`src/lib/emulator-core.ts` defines the minimal shared `EmulatorCore` interface
(`status`, `press`, `release`) and the generic `GamepadMapping<B>` shape. Generic hooks
depend on this, not on the concrete GBA/NES cores.

### Shared, generic hooks

Input hooks are generic and parameterized by button type — do **not** create
per-system copies:

- `useKeymap<B>(storageKey, defaults)` — remappable keymap persisted to localStorage
- `useKeyboardInput<B>(coreRef, keymap)` — keyboard → core
- `useGamepadInput<B>(coreRef, mapping, setInfo)` — Gamepad API polling with axis deadzone

GBA-only hooks: `useTurbo`, `useTurboShortcuts`, `useAutoSaveOnClose`.
NES-only hook: `useNesAutoSaveOnClose`.

`src/lib/hashRom.ts` is the single SHA-256 ROM hashing helper (first 16 hex chars,
used as a dedup key). Do not re-inline it.

### Storage layer

ROM bytes and save states both live in **IndexedDB** (not localStorage — that limit was
hit and migrated away from). localStorage is used only for ROM metadata lists, keymaps,
and theme.

| System | ROM store | Save-state store |
| --- | --- | --- |
| GBA | `romStore.ts` (`gba_rom_library`) | `saveStateStore.ts` (`gba_save_states`) |
| NES | `nesRomStore.ts` (`nes_rom_library`) | `nesSaveStateStore.ts` (`nes_save_states`) |
| DS | `dsRomStore.ts` (`ds_rom_library`) | managed by EmulatorJS |

ROM stores are built from the `createRomStore(dbName, metaListKey)` factory in
`createRomStore.ts`. Save-state store functions are **async** (they return Promises) —
always `await` them. GBA states are raw bytes; NES states are JSON strings.

## Critical gotchas

- **COOP/COEP headers** are set in `next.config.ts` (`same-origin` / `require-corp`).
  These are required for mGBA WASM (SharedArrayBuffer). Do not remove them.
- **mGBA assets** are served from `public/mgba/` via `locateFile`. `public/mgba/mgba.js`
  is intentionally excluded from ESLint.
- **Save-state APIs are async.** When wiring save/load UI, the slot-status check
  (`hasSaveState` / `hasNesSaveState`) must run in an effect + state, never inline in
  render.
- **DS depends on an external CDN** (`cdn.emulatorjs.org`). It will not work offline and
  is not version-pinned — flag this if reliability matters.
- The **README is the user-facing doc and can lag behind refactors.** Trust the code
  (and this file) over the README when they disagree.

## Adding a new emulator system

There is a step-by-step skill for this at
`.agents/skills/add-emulator-system/SKILL.md`. Follow it — the GBA/NES/DS split exists
specifically so new systems plug into the same generic hooks and storage factory.
