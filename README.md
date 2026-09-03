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
| Nintendo 3DS | Coming soon | — | `.3ds` |
| Nintendo Wii | Coming soon | — | `.rvz` |
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
- Automatic compact play mode after launching a ROM on screens below `1024px`
- Responsive ROM libraries with drag-and-drop import, play, and delete actions
- Status indicators for the loaded ROM and emulator state
- Shared Quick Menu for GBA and NES with keyboard and gamepad navigation
- Shared mobile virtual joystick with diagonal movement and stuck-input recovery
- Phone Controller pairing for GBA and NES through WebRTC and a connection modal
- Freely draggable Phone Controller layouts with size and opacity controls
- Accessible modal focus handling and `Escape` dismissal
- App-level and system-specific error recovery screens

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
- Phone Controller support with QR or six-digit pairing
- Mobile joystick, A/B, L/R, Start, and Select controls
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
- Phone Controller support with QR or six-digit pairing
- Mobile joystick, A/B, Start, and Select controls
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
- `VirtualJoystick` is shared by the GBA, NES, and Phone Controller interfaces.
  It supports cardinal and diagonal input and releases active directions when
  the pointer is cancelled, the page is hidden, or the window loses focus.

Gameplay input is suspended while the Quick Menu, Settings, or a confirmation
dialog is open.

### Phone Controller

GBA and NES can use another phone or browser tab as a controller:

1. Open **Quick Menu → Phone Controller** on the emulator.
2. Scan the QR code or open `/controller` and enter the six-digit code.
3. Confirm the code in the Phone Controller connection modal.
4. After the WebRTC DataChannel connects, button events travel directly between
   the phone and emulator.

The controller is designed for landscape use and provides a virtual joystick,
Start, Select, and system-specific action buttons. GBA and NES expose A/B only
because those are the face buttons supported by their cores. The control layout
is capability-based so X/Y can be added when a supported system such as SNES is
implemented.

After connecting, open the compact controller menu and select
**Customize layout**:

- Drag the joystick and each button independently.
- Use the arrow keys to nudge a selected control; hold `Shift` for larger steps.
- Adjust the global control size and opacity.
- Reset the active layout or select **Lock layout** when finished.
- Positions are clamped to the visible controller safe area.

Layouts use percentage-based coordinates and are stored separately for each
system and screen orientation. Landscape and portrait layouts therefore remain
independent and continue to fit different screen sizes.

The phone sends a heartbeat while connected. Both sides release held inputs when
the page is hidden, loses focus, or the peer connection is interrupted. A
temporary WebRTC interruption can recover without reloading the controller. If
the connection reaches the failed state, create a new pairing code from the
emulator.

The Next.js API stores only the temporary WebRTC offer/answer used for pairing.
Sessions expire after 10 minutes and are deleted when pairing completes or the
host disconnects. ROMs, save states, and gameplay input are not relayed through
the signaling API. Pairing creation and code lookup are rate limited.

Production deployments use Upstash Redis so the temporary session is available
across Vercel Function instances. Connect an Upstash Redis database through the
Vercel Marketplace and expose:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

The legacy `KV_REST_API_URL` and `KV_REST_API_TOKEN` names are also accepted.
Local development falls back to an in-memory store when Redis is not configured.
On Vercel, a missing or partial Redis configuration returns `503` instead of
silently using unreliable instance memory.

The first version targets devices on the same local network. DS is not supported
because it runs inside a separate sandboxed iframe.

### Error Recovery

Next.js App Router error boundaries protect the application from an unexpected
component or emulator failure:

- `src/app/error.tsx` handles application route failures.
- `src/app/global-error.tsx` provides a last-resort fallback if the root layout
  fails.
- GBA, NES, and DS each have a system-specific `error.tsx`.
- The shared recovery screen offers **Try again**, **Reload page**, and
  **Back to systems** actions.

The recovery UI does not display internal error messages or stack traces. A
full page reload is available for failures involving WASM, Web Workers, audio,
or other browser runtime state. Error recovery does not delete IndexedDB ROMs or
save states.

### Storage

ROM bytes and GBA/NES save states live in IndexedDB. localStorage is used only
for small synchronous data such as ROM metadata lists, keymaps, theme, and Phone
Controller layouts.

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
warnings, DS retry behavior after a simulated CDN failure, WebRTC Phone
Controller pairing, connection modal behavior, draggable layout safe areas,
layout persistence, and virtual joystick recovery. Vitest also covers the shared
error recovery screen, joystick direction handling, and layout preference
validation.

GitHub Actions runs lint, unit tests, installs Chromium, builds the application,
and runs the E2E suite on every push and pull request.

## Project Structure

```text
src/
├── app/                    # App Router pages, error boundaries, and theme tokens
├── components/
│   ├── shell/              # Shared home-page shell
│   ├── emulator/           # Quick Menu, joystick, error, and pairing UI
│   ├── gba/                # GBA player, console, library, controls, settings
│   ├── nes/                # NES player, console, library, controls, settings
│   ├── ds/                 # Sandboxed DS player and ROM library
│   └── phone-controller/   # Mobile WebRTC controller interface
└── lib/
    ├── gba/                # mGBA adapter and loader
    ├── nes/                # JSNES adapter and input mapping
    ├── hooks/              # Shared input, modal, turbo, and auto-save hooks
    ├── phone-controller/   # Signaling, WebRTC, validation, and shared types
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
