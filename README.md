# Web Emulator Lab 🎮

A browser-based retro game emulator platform built with Next.js 16, React 19, and Tailwind CSS 4. All ROM processing happens entirely client-side — nothing is ever uploaded to a server.

## Supported Systems

| System | Status | Core | ROM Format |
| --- | --- | --- | --- |
| Game Boy Advance | ✅ Available | mGBA (WASM) | `.gba` |
| NES | ✅ Available | JSNES | `.nes` |
| SNES | 🚧 Coming soon | — | — |
| Game Boy | 🚧 Coming soon | — | — |
| PlayStation 1 | 🚧 Coming soon | — | — |

## Features

### GBA Emulator

Powered by [mGBA](https://mgba.io/) compiled to WebAssembly via `@thenick775/mgba-wasm`. The WASM binary and JS glue are served from `public/mgba/` and loaded at runtime through a dynamic ESM/script loader.

- Upload `.gba` ROMs and play instantly
- ROM Library with persistent storage, cover art thumbnails, drag-and-drop import, and delete
- 3 save state slots with auto-save on page close (`pagehide` / `visibilitychange`) and auto-load on ROM open
- Turbo Mode (1x / 2x / 4x) with keyboard shortcuts: `T` to cycle, `1`/`2`/`4` for direct set, hold `Shift` for temporary turbo
- Turbo toast notifications on speed changes
- Remappable keyboard controls via the Keymap Editor in Settings
- Gamepad support via the Gamepad API with analog stick deadzone handling
- Mobile touch controls (D-Pad, A/B, L/R shoulders, Start/Select) — hidden on large screens
- Screenshot capture (also sets ROM cover art)
- Fullscreen mode
- Audio toggle

### NES Emulator

Powered by [JSNES](https://github.com/bfirsh/jsnes), a JavaScript NES emulator. The core runs a `requestAnimationFrame` loop, rendering each frame to a 256×240 canvas and piping audio samples through a `ScriptProcessorNode`.

- Upload `.nes` ROMs and play instantly
- Separate NES ROM Library (IndexedDB + localStorage), independent from GBA
- 3 save state slots (JSON-serialized emulator state stored in localStorage)
- Remappable keyboard controls via the NES Keymap Editor
- Gamepad support with NES-specific button mapping (no L/R shoulders)
- Mobile touch controls (D-Pad, A/B, Start/Select) — no shoulder buttons since NES doesn't have them
- Screenshot capture with cover art
- Fullscreen mode
- Audio toggle with Web Audio API (`AudioContext` + `ScriptProcessorNode`)

### Shared Features

- Home page with a system selection card grid — each system shows its status (available / coming soon)
- Dark / Light theme toggle with system preference detection, applied via a blocking `<script>` to prevent flash
- Responsive layout for desktop and mobile
- Settings panel slides in as a modal drawer (dismissible with `Escape`)
- Confirm dialogs for destructive actions (eject ROM, delete from library)

## Architecture

### Emulator Core Adapters

Each system has its own core adapter that implements a common interface pattern:

- `GbaCore` (`src/lib/gba/core-adapter.ts`) — wraps the mGBA WASM Module, handling ROM loading via the virtual filesystem, button mapping, save states, audio control, and turbo speed. Includes a stub core for UI development without the real backend.
- `NesCore` (`src/lib/nes/core-adapter.ts`) — wraps JSNES, converting ROM bytes to the string format JSNES expects, managing the frame loop, rendering pixel data to canvas via `ImageData`, and handling audio through `ScriptProcessorNode`.

### Input System

Each system defines its own button type, default keymap, and gamepad mapping:

- GBA: `A`, `B`, `L`, `R`, `START`, `SELECT`, `UP`, `DOWN`, `LEFT`, `RIGHT`
- NES: `A`, `B`, `START`, `SELECT`, `UP`, `DOWN`, `LEFT`, `RIGHT` (no shoulder buttons)

Input is handled through dedicated React hooks per system:
- `useKeyboardInput` / `useNesKeyboardInput` — keyboard event listeners mapped through the active keymap
- `useGamepadInput` / `useNesGamepadInput` — Gamepad API polling via `requestAnimationFrame` with button and axis support
- `useKeymap` / `useNesKeymap` — remappable keymap state persisted to localStorage

### Storage Layer

ROM bytes are stored in IndexedDB (no size limits), while metadata and save states use localStorage for fast synchronous reads:

- `romStore.ts` / `nesRomStore.ts` — ROM library per system (IndexedDB for bytes, localStorage for metadata: name, size, timestamps, cover art)
- `saveStateStore.ts` / `nesSaveStateStore.ts` — save state slots per system (GBA: base64-encoded binary, NES: JSON string)
- Each ROM is identified by a SHA-256 hash (first 16 hex chars) to deduplicate

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4
- **GBA Emulation:** mGBA WASM (`@thenick775/mgba-wasm`)
- **NES Emulation:** JSNES (`jsnes`)
- **Storage:** IndexedDB (ROM bytes), localStorage (save states, settings, keymaps, ROM metadata)
- **Language:** TypeScript
- **Fonts:** Geist Sans & Geist Mono (via `next/font`)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), pick a system, and upload a ROM to start playing.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, theme script, toast provider)
│   ├── page.tsx                # Home — system selection grid
│   ├── globals.css             # Global styles & CSS variables
│   ├── gba/page.tsx            # GBA emulator page
│   └── nes/page.tsx            # NES emulator page
│
├── components/
│   ├── SystemCard.tsx          # System card (image, status badge, link)
│   ├── ThemeToggle.tsx         # Dark/Light switch
│   ├── ThemeScript.tsx         # Blocking script to apply theme before paint
│   │
│   ├── gba/
│   │   ├── GbaPlayer.tsx       # GBA emulator orchestrator
│   │   ├── GbaConsole.tsx      # Canvas wrapper (4:3 aspect, scanlines, glow)
│   │   ├── RomLibrary.tsx      # ROM list with play/delete
│   │   ├── RomDropzone.tsx     # Drag-and-drop ROM import
│   │   ├── SettingsPanel.tsx   # Settings drawer (turbo, save, keymap)
│   │   ├── KeymapEditor.tsx    # Keyboard rebinding UI
│   │   ├── MobileControls.tsx  # Touch buttons (D-Pad, A/B, L/R, Start/Select)
│   │   ├── TouchControls.tsx   # Touch control utilities
│   │   ├── KeyboardHints.tsx   # Keyboard shortcut reference
│   │   ├── TurboControl.tsx    # Turbo speed selector
│   │   ├── TurboToastProvider.tsx  # Turbo change notification context
│   │   └── ConfirmDialog.tsx   # Confirmation modal
│   │
│   └── nes/
│       ├── NesPlayer.tsx       # NES emulator orchestrator
│       ├── NesConsole.tsx      # Canvas wrapper (256×240, scanlines)
│       ├── NesRomLibrary.tsx   # NES ROM list
│       ├── NesRomDropzone.tsx  # NES drag-and-drop import
│       ├── NesSettingsPanel.tsx    # NES settings drawer (save, keymap)
│       ├── NesKeymapEditor.tsx # NES keyboard rebinding UI
│       ├── MobileControls.tsx  # NES touch buttons (no shoulders)
│       └── ConfirmDialog.tsx   # Confirmation modal
│
└── lib/
    ├── input.ts                # GBA button type & default keymap
    ├── gamepad.ts              # GBA gamepad mapping
    ├── storage.ts              # Generic IndexedDB helpers
    │
    ├── gba/
    │   ├── core-adapter.ts     # GbaCore interface & mGBA WASM adapter
    │   ├── mgba-loader.ts      # Dynamic mGBA JS/WASM loader
    │   └── mgba-runtime.ts     # (reserved)
    │
    ├── nes/
    │   ├── core-adapter.ts     # NesCore interface & JSNES adapter
    │   ├── input.ts            # NES button type & default keymap
    │   └── gamepad.ts          # NES gamepad mapping
    │
    ├── hooks/
    │   ├── useKeyboardInput.ts     # GBA keyboard → core
    │   ├── useGamepadInput.ts      # GBA gamepad → core
    │   ├── useKeymap.ts            # GBA remappable keymap (localStorage)
    │   ├── useTurbo.ts             # GBA turbo state → core
    │   ├── useTurboShortcuts.ts    # GBA turbo keyboard shortcuts
    │   ├── useAutoSaveOnClose.ts   # GBA auto-save on page hide
    │   ├── useNesKeyboardInput.ts  # NES keyboard → core
    │   ├── useNesGamepadInput.ts   # NES gamepad → core
    │   └── useNesKeymap.ts         # NES remappable keymap (localStorage)
    │
    └── storage/
        ├── romStore.ts             # GBA ROM library (IDB + localStorage)
        ├── saveStateStore.ts       # GBA save states (localStorage, base64)
        ├── nesRomStore.ts          # NES ROM library (IDB + localStorage)
        └── nesSaveStateStore.ts    # NES save states (localStorage, JSON)

public/
├── images/          # System card images
└── mgba/
    ├── mgba.js      # mGBA JavaScript glue
    └── mgba.wasm    # mGBA WebAssembly binary
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |

## Repository

[github.com/pathipat11/web-emulator](https://github.com/pathipat11/web-emulator)
