# Web Emulator Lab 🎮

Web Emulator Lab is a browser-based retro game emulator built with Next.js 16,
React 19, Tailwind CSS 4, and TypeScript. ROM files are processed locally in the
browser and are never uploaded to an application server.

## Supported Systems

| System | Status | Core | ROM |
| --- | --- | --- | --- |
| Game Boy Advance | Available | mGBA (WASM) | `.gba` |
| Nintendo NES | Available | JSNES | `.nes` |
| Nintendo DS | Available | EmulatorJS / DeSmuME 2015 | `.nds` |
| Super Nintendo | Coming soon | — | `.sfc` |
| Game Boy | Coming soon | — | `.gb` |
| PlayStation | Coming soon | — | `.cue` |
| PlayStation Portable | Coming soon | PPSSPP | `.iso` |

## Current UI

- RetroArch-inspired system browser and player layouts
- Dark and light themes; the selected theme is stored in localStorage and
  defaults to dark
- Player and Library tabs for every available system
- Focus mode on every player; press `F2` to hide or restore the interface
- Responsive ROM libraries with drag-and-drop import, play, and delete actions
- Status indicators for the loaded ROM and emulator state
- Shared Quick Menu for GBA and NES with keyboard and gamepad navigation
- Accessible modal focus handling and `Escape` dismissal

## Emulator Features

### Game Boy Advance

The GBA player wraps `@thenick775/mgba-wasm` behind the typed `GbaCore` adapter.
The JavaScript glue and WASM binary are served from `public/mgba/`.

- Persistent ROM library backed by IndexedDB
- Three portable save-state slots stored as raw bytes in IndexedDB
- Optional auto-save every 30 seconds and when the page becomes hidden
- Automatic save-state load from the selected slot when opening a ROM
- Clean ROM reset without restoring mGBA's separate internal auto state
- Turbo speeds: 1x, 2x, and 4x
- Turbo shortcuts: `T`, `1`, `2`, `4`, and hold `Shift` for temporary turbo
- Remappable keyboard controls
- Gamepad support through the browser Gamepad API
- Mobile D-Pad, A/B, L/R, Start, and Select controls
- Screenshot, cover-art capture, audio toggle, and fullscreen

### Nintendo NES

The NES player wraps JSNES behind the typed `NesCore` adapter. Frames are
rendered to a 256×240 canvas and audio is sent through the Web Audio API.

- Independent IndexedDB ROM library
- Three save-state slots stored as JSON in IndexedDB
- Optional auto-save every 30 seconds and when the page becomes hidden
- ROM reload-based reset with surfaced error handling
- Remappable keyboard controls
- Gamepad support with NES-specific button mapping
- Mobile D-Pad, A/B, Start, and Select controls
- Screenshot, cover-art capture, audio toggle, and fullscreen

### Nintendo DS

The DS player runs EmulatorJS 4.2.3 with the DeSmuME 2015 core inside a
sandboxed iframe. EmulatorJS assets are downloaded from `cdn.emulatorjs.org`
when a ROM is launched.

- Independent IndexedDB ROM library
- Keyboard, gamepad, and touch controls provided by EmulatorJS
- Nonce-based iframe Content Security Policy
- Opaque sandbox origin without `allow-same-origin`
- In-memory storage compatibility shim with EmulatorJS database and
  localStorage persistence disabled
- Frame handshake, startup timeout, and surfaced load errors
- Retry after CDN or startup failure using the ROM already stored in IndexedDB
- Restart the current ROM without selecting the file again
- Fullscreen and eject controls

DS emulation requires an internet connection. Persistent DS save states are
currently disabled inside the restricted iframe.

## Architecture

### Core Adapters

- `src/lib/gba/core-adapter.ts` wraps the mGBA WASM module, virtual filesystem,
  input, save states, audio, reset, and turbo behavior.
- `src/lib/nes/core-adapter.ts` wraps JSNES, its frame loop, canvas output,
  audio, input, reset, and serialized state.
- DS intentionally has no custom core adapter. `DsPlayer` creates the isolated
  EmulatorJS document and communicates with it through `postMessage`.

The shared `EmulatorCore` interface contains the minimal `status`, `press`, and
`release` contract used by generic input hooks.

### Shared Input and Modal Hooks

- `useKeymap<B>` persists remappable keyboard mappings in localStorage.
- `useKeyboardInput<B>` maps keyboard events to a compatible emulator core.
- `useGamepadInput<B>` polls the Gamepad API with axis deadzone handling and
  releases held buttons when input is suspended or a controller disconnects.
- `useGamepadMenuNavigation` supports D-Pad/analog navigation, A to select, and
  B to close menus.
- `useModalDialog` manages initial focus, focus trapping, scroll locking, and
  focus restoration.

Gameplay input is suspended while the Quick Menu, Settings, or a confirmation
dialog is open.

### Storage

ROM bytes and GBA/NES save states live in IndexedDB. localStorage is used only
for small synchronous data such as ROM metadata lists, keymaps, and theme.

| System | ROM database | Save-state database |
| --- | --- | --- |
| GBA | `gba_rom_library` | `gba_save_states` |
| NES | `nes_rom_library` | `nes_save_states` |
| DS | `ds_rom_library` | Disabled in the sandboxed player |

ROM stores are created through `createRomStore(dbName, metaListKey)`. ROMs use
the first 16 hexadecimal characters of a SHA-256 hash as their deduplication
key. Save-state APIs are asynchronous and must be awaited.

### Browser Security Requirements

`next.config.ts` sends these headers on every route:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

They are required for the threaded mGBA WASM runtime and `SharedArrayBuffer`.
Do not remove them without replacing the mGBA runtime strategy.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, choose a system, and load a ROM that you are
legally entitled to use.

The DS player additionally needs access to `cdn.emulatorjs.org`.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build and type-check the app |
| `npm run start` | Serve an existing production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest unit suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Build the app and run Playwright E2E tests |

The Playwright suite covers GBA, NES, and DS on desktop and mobile Chromium. It
checks primary navigation, Focus mode, Quick Menu behavior, hydration/script
warnings, and DS retry behavior after a simulated CDN failure.

GitHub Actions runs lint, unit tests, installs Chromium, builds the application,
and runs the E2E suite on every push and pull request.

## Project Structure

```text
src/
├── app/                    # App Router pages, root layout, and theme tokens
├── components/
│   ├── shell/              # Shared home-page shell
│   ├── emulator/           # Shared Quick Menu
│   ├── gba/                # GBA player, console, library, controls, settings
│   ├── nes/                # NES player, console, library, controls, settings
│   └── ds/                 # Sandboxed DS player and ROM library
└── lib/
    ├── gba/                # mGBA adapter and loader
    ├── nes/                # JSNES adapter and input mapping
    ├── hooks/              # Shared input, modal, turbo, and auto-save hooks
    ├── storage/            # ROM and save-state IndexedDB stores
    ├── emulator-core.ts    # Shared emulator/input contracts
    └── hashRom.ts          # Shared SHA-256 ROM hashing

e2e/                        # Playwright desktop/mobile tests
public/mgba/                # Same-origin mGBA JavaScript and WASM assets
.github/workflows/ci.yml    # Lint, unit, build, and E2E CI
```

## Adding Another System

Read [`AGENTS.md`](./AGENTS.md) before changing the repository. New emulator
systems should follow
[`.agents/skills/add-emulator-system/SKILL.md`](./.agents/skills/add-emulator-system/SKILL.md)
so they reuse the generic input hooks and ROM storage factory.

## Repository

[github.com/pathipat11/web-emulator](https://github.com/pathipat11/web-emulator)
