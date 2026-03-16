# Web Emulator Lab 🎮

A browser-based retro game emulator platform built with Next.js 16, React 19, and Tailwind CSS 4. The GBA emulator runs on [mGBA WASM](https://github.com/nickthenick775/mgba-wasm) — all ROM processing happens entirely client-side. Nothing is ever uploaded to a server.

## Supported Systems

| System | Status |
| --- | --- |
| Game Boy Advance (GBA) | ✅ Available |
| NES | 🚧 Coming soon |
| SNES | 🚧 Coming soon |
| Game Boy | 🚧 Coming soon |
| PlayStation 1 | 🚧 Coming soon |

## Features

### Emulator Core

- Upload a `.gba` ROM file and play instantly in the browser
- Powered by mGBA compiled to WebAssembly (`@thenick775/mgba-wasm`)
- The WASM binary and JS glue are served from `public/mgba/` and loaded at runtime via a dynamic script/ESM loader (`mgba-loader.ts`)
- A `GbaCore` adapter interface (`core-adapter.ts`) wraps the raw mGBA Module, providing a clean API for ROM loading, button input, save states, audio control, and turbo speed
- A stub core is also available for UI development without the real emulator backend

### ROM Library

- ROMs are automatically added to a persistent library on first upload
- ROM bytes are stored in IndexedDB (no size limits), while metadata (name, size, timestamps, cover art) lives in localStorage for fast reads
- Each ROM is identified by a SHA-256 hash (first 16 hex chars) to avoid duplicates
- Library view shows all ROMs sorted by last played, with cover art thumbnails, file size, and timestamps
- Drag-and-drop import via a dropzone component
- Delete ROMs and their associated save data from the library

### Save / Load States

- 3 save state slots per ROM
- Save states are serialized to base64 and stored in localStorage, keyed by ROM hash + slot number
- Auto Save on page close — when enabled, the emulator automatically saves to a chosen slot on `pagehide` / `visibilitychange` events
- Auto Load on ROM open — optionally restores the last auto-saved state when a ROM is loaded
- Save metadata (ROM name, last slot, timestamp) is tracked separately for potential future UI use

### Turbo Mode

- Speed multiplier: 1x (normal), 2x, 4x
- Configurable from the Settings panel
- Keyboard shortcuts:
  - `T` — cycle through 1x → 2x → 4x
  - `1` / `2` / `4` — set speed directly
  - Hold `Shift` — temporary turbo (reverts on release)
- Turbo state is re-applied after ROM load, resume, reset, and load-state to handle mGBA builds that reset speed internally
- A toast notification appears on turbo changes

### Input

#### Keyboard
- Default keymap: Arrow keys (D-Pad), `Z` (A), `X` (B), `A` (L), `S` (R), `Enter` (Start), `Shift` (Select)
- Fully remappable via the Keymap Editor in Settings — click a button, then press a key to rebind
- Custom keymaps are persisted in localStorage

#### Gamepad
- Native Gamepad API support with automatic detection
- Default mapping follows the standard gamepad layout (face buttons, shoulders, D-Pad)
- Analog stick support with configurable deadzone (default 0.35)
- Axis mapping: left stick X/Y → D-Pad directions
- Gamepad status is displayed in the header

#### Mobile Touch Controls
- On-screen touch overlay rendered below the emulator canvas on small screens (hidden on `lg+` breakpoint)
- Layout mimics a real GBA: L/R shoulder buttons on top, D-Pad on the left, A/B buttons in a diamond layout on the right, Start/Select in the center
- Uses pointer events with `setPointerCapture` for reliable touch tracking
- Supports hold (continuous press)

### UI & Theming

- Dark / Light theme toggle with system preference detection
- Theme is applied via a blocking `<script>` in `<head>` (`ThemeScript.tsx`) to prevent flash of wrong theme
- Responsive layout — works on desktop and mobile
- Retro-styled card grid on the home page for system selection
- Settings panel slides in from the right as a modal drawer (keyboard dismissible with `Escape`)
- Confirm dialogs for destructive actions (eject ROM, delete from library)
- Fullscreen mode via the Fullscreen API
- Screenshot capture — saves a PNG of the current frame and sets it as the ROM's cover art

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4
- **Emulation:** mGBA WASM (`@thenick775/mgba-wasm`)
- **Storage:** IndexedDB (ROM bytes), localStorage (save states, settings, keymap, ROM metadata)
- **Language:** TypeScript
- **Fonts:** Geist Sans & Geist Mono (via `next/font`)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), select GBA, and upload a `.gba` file to start playing.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx             # Root layout (fonts, theme script, toast provider)
│   ├── page.tsx               # Home page — system selection grid
│   ├── globals.css            # Global styles & CSS variables
│   └── gba/
│       └── page.tsx           # GBA emulator page
│
├── components/
│   ├── SystemCard.tsx         # System selection card with image, status, link
│   ├── ThemeToggle.tsx        # Dark/Light theme switch
│   ├── ThemeScript.tsx        # Blocking script to apply theme before paint
│   └── gba/
│       ├── GbaPlayer.tsx      # Main emulator orchestrator (ROM loading, state management, controls)
│       ├── GbaConsole.tsx     # Canvas wrapper for the emulator screen
│       ├── RomLibrary.tsx     # ROM library list with import, play, delete
│       ├── RomDropzone.tsx    # Drag-and-drop file import zone
│       ├── SettingsPanel.tsx  # Slide-in settings drawer (turbo, save, keymap)
│       ├── KeymapEditor.tsx   # Interactive keyboard rebinding UI
│       ├── MobileControls.tsx # On-screen touch buttons for mobile
│       ├── TouchControls.tsx  # Touch control utilities
│       ├── KeyboardHints.tsx  # Keyboard shortcut reference
│       ├── TurboControl.tsx   # Turbo speed selector
│       ├── TurboToastProvider.tsx # Context provider for turbo change notifications
│       └── ConfirmDialog.tsx  # Reusable confirmation modal
│
└── lib/
    ├── input.ts               # GbaButton type & default keyboard mapping
    ├── gamepad.ts             # Gamepad button/axis mapping definitions
    ├── storage.ts             # Generic IndexedDB helpers (idbSet/idbGet/idbDel)
    ├── gba/
    │   ├── core-adapter.ts    # GbaCore interface & mGBA WASM adapter (turbo, audio, save states)
    │   ├── mgba-loader.ts     # Dynamic loader for mGBA JS/WASM (ESM import with script tag fallback)
    │   └── mgba-runtime.ts    # (reserved for future runtime utilities)
    ├── hooks/
    │   ├── useKeyboardInput.ts    # Keyboard → GbaCore button press/release
    │   ├── useGamepadInput.ts     # Gamepad API polling → GbaCore input
    │   ├── useKeymap.ts           # Remappable keymap state (persisted to localStorage)
    │   ├── useTurbo.ts            # Turbo rate state synced to core
    │   ├── useTurboShortcuts.ts   # Keyboard shortcuts for turbo (cycle, hold, direct set)
    │   └── useAutoSaveOnClose.ts  # Auto-save on page hide / visibility change
    └── storage/
        ├── romStore.ts            # ROM library: IndexedDB for bytes, localStorage for metadata
        └── saveStateStore.ts      # Save state slots: base64 in localStorage

public/
├── images/          # System card images (GBA, NES, SNES, GB, PS1)
└── mgba/
    ├── mgba.js      # mGBA JavaScript glue code
    └── mgba.wasm    # mGBA WebAssembly binary
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |
