/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMgbaWasmCore, type GbaCore } from "@/lib/gba/core-adapter";
import { useKeyboardInput } from "@/lib/hooks/useKeyboardInput";
import { useGamepadInput } from "@/lib/hooks/useGamepadInput";
import { defaultGamepadMapping } from "@/lib/gamepad";
import type { GbaButton } from "@/lib/input";

import ThemeToggle from "@/components/ThemeToggle";
import { GbaConsole } from "@/components/gba/GbaConsole";
import { MobileControls } from "@/components/gba/MobileControls";
import { SettingsPanel } from "@/components/gba/SettingsPanel";
import { ConfirmDialog } from "@/components/gba/ConfirmDialog";
import { EmulatorQuickMenu } from "@/components/emulator/QuickMenu";
import { PhoneControllerDialog } from "@/components/emulator/PhoneControllerDialog";
import { RomLibrary } from "@/components/gba/RomLibrary";
import Link from "next/link";

import { useTurbo } from "@/lib/hooks/useTurbo";
import { TurboRate } from "@/lib/gba/core-adapter";
import { useTurboShortcuts } from "@/lib/hooks/useTurboShortcuts";
import { useAutoSaveOnClose } from "@/lib/hooks/useAutoSaveOnClose";
import { useKeymap } from "@/lib/hooks/useKeymap";
import { usePhoneController } from "@/lib/hooks/usePhoneController";
import { defaultKeymap } from "@/lib/input";
import { getSaveState, type Slot } from "@/lib/storage/saveStateStore";
import { getRomBytes, touchLastPlayed, setCoverArt } from "@/lib/storage/romStore";

type Tab = "emulator" | "library";

const GBA_PHONE_BUTTONS: readonly GbaButton[] = [
    "UP",
    "DOWN",
    "LEFT",
    "RIGHT",
    "A",
    "B",
    "L",
    "R",
    "START",
    "SELECT",
];

async function loadPortableState(
    core: GbaCore,
    romHash: string,
    slot: Slot,
): Promise<boolean> {
    const bytes = await getSaveState(romHash, slot);
    if (!bytes) return false;
    if (!core.loadStateBytes) {
        throw new Error("This mGBA build cannot load portable save states.");
    }
    await core.loadStateBytes(slot, bytes);
    return true;
}

export default function GbaPlayer() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const coreRef = useRef<GbaCore | null>(null);

    const [tab, setTab] = useState<Tab>("emulator");
    const [romName, setRomName] = useState("-");
    const [romHashState, setRomHashState] = useState("");
    const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
    const [coreState, setCoreState] = useState<"loading" | "ready" | "error">("loading");
    const [message, setMessage] = useState(
        "Open Library to add or choose a .gba ROM.",
    );

    const [gamepadInfo, setGamepadInfo] = useState("No controller");
    const [showSettings, setShowSettings] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showQuickMenu, setShowQuickMenu] = useState(false);
    const [showPhoneController, setShowPhoneController] = useState(false);
    const [showEjectConfirm, setShowEjectConfirm] = useState(false);
    const [saveVersion, setSaveVersion] = useState(0);
    const [menuHidden, setMenuHidden] = useState(false);

    // audio
    const [audioEnabled, setAudioEnabled] = useState(true);
    const audioEnabledRef = useRef(true);

    useEffect(() => {
        audioEnabledRef.current = audioEnabled;
        coreRef.current?.setAudioEnabled?.(audioEnabled);
    }, [audioEnabled]);

    // turbo (UI + apply to core if available)
    const { turbo, setTurbo } = useTurbo(coreRef);

    useTurboShortcuts({
        coreRef,
        turbo: turbo as TurboRate,
        setTurbo,
        holdKey: "Shift",
        holdRate: 2,
    });

    // auto-save toggles
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
    const [autoSaveSlot, setAutoSaveSlot] = useState<Slot>(1);
    const [autoLoadOnRom, setAutoLoadOnRom] = useState(true);

    // keymap (remappable)
    const { keymap, setKey: setKeymapKey, resetToDefaults: resetKeymap } = useKeymap<GbaButton>("gba:keymap", defaultKeymap);
    const {
        state: phoneControllerState,
        startPairing: startPhonePairing,
        stopPairing: stopPhonePairing,
    } = usePhoneController({
        coreRef,
        system: "gba",
        buttons: GBA_PHONE_BUTTONS,
    });

    // inputs
    const gameplayInputEnabled =
        !showQuickMenu &&
        !showSettings &&
        !showPhoneController &&
        !showEjectConfirm;
    useKeyboardInput(coreRef, keymap, gameplayInputEnabled);
    useGamepadInput(coreRef, defaultGamepadMapping, setGamepadInfo, gameplayInputEnabled);

    // init core + canvas
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const c = await createMgbaWasmCore();
                if (cancelled) return;

                coreRef.current = c;

                const canvas = canvasRef.current;
                if (canvas) c.attachCanvas(canvas);

                c.setAudioEnabled?.(audioEnabledRef.current);

                setCoreState("ready");
                setMessage("mGBA core ready. Open Library to choose a ROM.");
            } catch (err: any) {
                console.error(err);
                setCoreState("error");
                setMessage(`Failed to init core: ${err?.message ?? String(err)}`);
            }
        })();

        return () => {
            cancelled = true;
            // stop core when component unmounts (e.g. navigating away)
            const c = coreRef.current;
            if (c) {
                c.pause();
                c.setAudioEnabled?.(false);
            }
        };
    }, []);

    const canInteract = useMemo(() => status !== "idle", [status]);

    useAutoSaveOnClose({
        coreRef,
        romHash: romHashState,
        romName,
        enabled: autoSaveEnabled && status !== "idle",
        slot: autoSaveSlot,
        setMessage,
        onSaveVersion: () => setSaveVersion((v) => v + 1),
    });

    /** Capture current canvas frame as cover art for the current ROM */
    function saveCoverArt() {
        if (!romHashState || !canvasRef.current) return;
        try {
            const url = canvasRef.current.toDataURL("image/png");
            setCoverArt(romHashState, url);
        } catch { /* ignore */ }
    }

    /** Load a ROM from the library by hash (no file picker needed) */
    const loadRomFromLibrary = useCallback(
        async (romHash: string, name: string) => {
            if (coreState !== "ready") {
                setMessage(
                    coreState === "loading"
                        ? "mGBA core is still loading."
                        : "mGBA core is unavailable. Reload the page and try again.",
                );
                return;
            }

            // stop current game before loading a new one
            const prev = coreRef.current;
            if (prev && prev.status !== "idle") {
                saveCoverArt();
                prev.pause();
                prev.setAudioEnabled?.(false);
            }

            const bytes = await getRomBytes(romHash);
            if (!bytes) {
                setMessage("ROM not found in library.");
                return;
            }

            setRomName(name);
            setRomHashState(romHash);
            touchLastPlayed(romHash);
            setTab("emulator");
            setMessage(`ROM loaded: ${name} (${bytes.length.toLocaleString()} bytes)`);

            try {
                const core = coreRef.current;
                if (!core) throw new Error("mGBA core is not ready.");

                await core.loadRom(bytes, name);
                let loadedMessage = `ROM loaded: ${name} (${bytes.length.toLocaleString()} bytes)`;
                if (autoLoadOnRom) {
                    try {
                        if (await loadPortableState(core, romHash, autoSaveSlot)) {
                            loadedMessage = `ROM loaded: ${name} (auto-loaded slot ${autoSaveSlot})`;
                        }
                    } catch (error) {
                        console.error(error);
                        loadedMessage = `ROM loaded, but auto-load slot ${autoSaveSlot} failed: ${
                            error instanceof Error ? error.message : String(error)
                        }`;
                    }
                }
                setStatus(core.status);
                setMessage(loadedMessage);
                core.setAudioEnabled?.(audioEnabledRef.current);

                const c: any = core;
                if (typeof c?.setTurbo === "function") c.setTurbo(turbo);
                else if (typeof c?.setSpeedMultiplier === "function") c.setSpeedMultiplier(turbo);
            } catch (err: any) {
                console.error(err);
                setMessage(`Failed to start core: ${err?.message ?? String(err)}`);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [autoLoadOnRom, autoSaveSlot, coreState, turbo, romHashState],
    );

    function onToggleRun() {
        const c = coreRef.current;
        if (!c) return;

        if (c.status === "running") {
            c.pause();
            setStatus("paused");
            c.setAudioEnabled?.(audioEnabledRef.current);
            setMessage("Paused.");
        } else {
            c.start();
            setStatus("running");
            c.setAudioEnabled?.(audioEnabledRef.current);
            setMessage("Running.");
        }
    }

    function onReset() {
        const c = coreRef.current;
        if (!c) return;

        try {
            c.reset();
            setStatus(c.status);
            c.setAudioEnabled?.(audioEnabledRef.current);
            setMessage("Reset.");
        } catch (error) {
            setStatus(c.status);
            setMessage(
                `Reset failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    function onEject() {
        const c = coreRef.current;
        if (!c) return;

        // save cover art before ejecting
        saveCoverArt();

        c.pause();
        c.setAudioEnabled?.(false);
        setStatus("idle");
        setRomName("-");
        setRomHashState("");
        setMessage("ROM ejected. Open Library to choose another ROM.");

        // clear canvas to black
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    }

    async function onSave(slot: Slot) {
        const c = coreRef.current;
        if (!c) return;
        if (!romHashState) {
            setMessage("Load a ROM first.");
            return;
        }

        try {
            const { putSaveState, putMeta } = await import("@/lib/storage/saveStateStore");

            if (typeof c.saveStateBytes === "function") {
                const bytes: Uint8Array | null = await c.saveStateBytes(slot);
                if (bytes && bytes.length > 0) {
                    await putSaveState(romHashState, slot, bytes);
                    await putMeta({ romHash: romHashState, romName, updatedAt: Date.now(), lastSlot: slot });
                    setMessage(`Saved state to slot ${slot} (${bytes.length.toLocaleString()} bytes).`);
                } else {
                    // saveStateBytes already asked mGBA to save this slot, but the
                    // portable file could not be identified safely.
                    setMessage(`Saved state to slot ${slot} (internal only — export unavailable).`);
                }
            } else {
                await c.saveState(slot);
                setMessage(`Saved state to slot ${slot}.`);
            }

            setSaveVersion((v) => v + 1);
        } catch (err: any) {
            console.error(err);
            setMessage(`Save failed: ${err?.message ?? String(err)}`);
        }
    }

    async function onExportSave(slot: Slot) {
        if (!romHashState) {
            setMessage("Load a ROM first.");
            return;
        }
        const bytes = await getSaveState(romHashState, slot);
        if (!bytes) {
            setMessage(`No save data in slot ${slot}.`);
            return;
        }
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${romName.replace(/\.[^/.]+$/, "")}_slot${slot}.sav`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage(`Exported save slot ${slot}.`);
    }

    async function onImportSave(slot: Slot, file: File) {
        if (!romHashState) {
            setMessage("Load a ROM first.");
            return;
        }
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const { putSaveState, putMeta } = await import("@/lib/storage/saveStateStore");
        await putSaveState(romHashState, slot, bytes);
        await putMeta({ romHash: romHashState, romName, updatedAt: Date.now(), lastSlot: slot });
        setSaveVersion((v) => v + 1);

        // Also load the imported state into the running emulator
        const c = coreRef.current;
        if (c && status !== "idle" && typeof c.loadStateBytes === "function") {
            try {
                await c.loadStateBytes(slot, bytes);
                c.setAudioEnabled?.(audioEnabledRef.current);
                setMessage(`Imported & loaded save slot ${slot}.`);
            } catch {
                setMessage(`Imported save to slot ${slot} (load manually via Load button).`);
            }
        } else {
            setMessage(`Imported save to slot ${slot} (${bytes.length.toLocaleString()} bytes).`);
        }
    }

    async function onLoad(slot: Slot) {
        const c = coreRef.current;
        if (!c) return;
        if (!romHashState) {
            setMessage("Load a ROM first.");
            return;
        }

        try {
            // Try loading from IndexedDB first (our portable save)
            if (typeof c.loadStateBytes === "function") {
                const bytes = await getSaveState(romHashState, slot);
                if (bytes) {
                    await c.loadStateBytes(slot, bytes);
                    setMessage(`Loaded state from slot ${slot}.`);
                    c.setAudioEnabled?.(audioEnabledRef.current);
                    return;
                }
            }

            // Fallback: use mGBA's internal load (works if saved via Module.saveState)
            await c.loadState(slot);
            setMessage(`Loaded state from slot ${slot}.`);
            c.setAudioEnabled?.(audioEnabledRef.current);
        } catch (err: any) {
            console.error(err);
            setMessage(`Load failed: ${err?.message ?? String(err)}`);
        }
    }

    function onFullscreen() {
        canvasRef.current?.requestFullscreen?.();
    }

    function onScreenshot() {
        const c = canvasRef.current;
        if (!c) return;

        const url = c.toDataURL("image/png");

        // also save as cover art
        if (romHashState) setCoverArt(romHashState, url);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${romName.replace(/\.[^/.]+$/, "") || "screenshot"}.png`;
        a.click();
    }

    function openSettings() {
        setShowQuickMenu(false);
        setShowSettings(true);
        requestAnimationFrame(() => setSettingsOpen(true));
    }

    function closeSettings() {
        setSettingsOpen(false);
        window.setTimeout(() => setShowSettings(false), 220);
    }

    // F2 shortcut to toggle menu visibility
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F2") {
                e.preventDefault();
                setMenuHidden((hidden) => {
                    if (!hidden) setTab("emulator");
                    return !hidden;
                });
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    function press(btn: GbaButton) {
        coreRef.current?.press(btn);
    }
    function release(btn: GbaButton) {
        coreRef.current?.release(btn);
    }

    return (
        <div className="min-h-screen bg-(--bg)">
            {menuHidden ? (
                <button
                    onClick={() => setMenuHidden(false)}
                    className="fixed right-2 top-2 z-30 rounded-lg border border-(--border) bg-(--panel-translucent) px-2.5 py-1.5 text-[10px] font-bold shadow-(--shadow) backdrop-blur transition hover:border-(--accent-border) lg:right-4 lg:top-4 lg:rounded-xl lg:px-3 lg:py-2 lg:text-xs"
                    type="button"
                    title="Show interface (F2)"
                >
                    Show interface
                </button>
            ) : (
                <header className="sticky top-0 z-30 border-b border-(--border) bg-(--bg-translucent) backdrop-blur-xl">
                    <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-2 px-2 sm:px-4 lg:min-h-18 lg:gap-4 lg:px-8">
                        <div className="flex min-w-0 items-center gap-3">
                            <Link
                                href="/"
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-(--accent) text-[10px] font-black text-(--accent-text) shadow-(--accent-shadow) lg:h-10 lg:w-10 lg:rounded-xl lg:text-xs"
                                aria-label="Back to systems"
                                title="Back to systems"
                            >
                                GBA
                            </Link>
                            <div className="min-w-0">
                                <div className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-(--accent) lg:block">
                                    mGBA core
                                </div>
                                <h1 className="truncate text-sm font-black tracking-tight lg:text-xl">
                                    Game Boy Advance
                                </h1>
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            <span className="hidden max-w-52 truncate rounded-xl border border-(--border) bg-(--panel) px-3 py-2 text-xs text-(--muted) md:block">
                                {gamepadInfo}
                            </span>
                            <div className="hidden lg:block">
                                <ThemeToggle />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowQuickMenu(true)}
                                className="rounded-lg border border-(--border) bg-(--panel) px-2.5 py-2 text-[10px] font-bold transition hover:border-(--accent-border) hover:bg-(--panel-2) lg:rounded-xl lg:px-3 lg:py-2.5 lg:text-xs"
                            >
                                Quick Menu
                            </button>
                        </div>
                    </div>
                </header>
            )}

            <main className={[
                "mx-auto w-full",
                menuHidden
                    ? "flex min-h-screen max-w-7xl items-center px-2 lg:px-8"
                    : "max-w-7xl px-2 pb-3 pt-2 sm:px-4 lg:px-8 lg:pb-8 lg:pt-5",
            ].join(" ")}>
                {!menuHidden && (
                    <div className="mb-2 flex items-center justify-between gap-2 lg:mb-5 lg:gap-3">
                        <div className="inline-flex rounded-xl border border-(--border) bg-(--panel) p-1">
                            {(["emulator", "library"] as const).map((nextTab) => (
                                <button
                                    key={nextTab}
                                    onClick={() => setTab(nextTab)}
                                    className={[
                                        "rounded-lg px-3 py-1.5 text-[10px] font-bold transition lg:px-4 lg:py-2 lg:text-xs",
                                        tab === nextTab
                                            ? "bg-(--accent) text-(--accent-text)"
                                            : "text-(--muted) hover:bg-(--panel-2) hover:text-(--text)",
                                    ].join(" ")}
                                    type="button"
                                >
                                    {nextTab === "emulator" ? "Player" : "Library"}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setTab("emulator");
                                setMenuHidden(true);
                            }}
                            className="rounded-lg border border-(--border) bg-(--panel) px-2.5 py-1.5 text-[10px] font-bold text-(--muted) transition hover:border-(--accent-border) hover:text-(--text) lg:rounded-xl lg:px-3 lg:py-2 lg:text-xs"
                            title="Hide interface (F2)"
                        >
                            Focus mode
                        </button>
                    </div>
                )}

                <div className={tab !== "emulator" ? "hidden" : "w-full"}>
                    {!menuHidden && (
                        <div className="hidden flex-col gap-3 py-1 lg:flex lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className={[
                                    "h-2.5 w-2.5 shrink-0 rounded-full",
                                    coreState === "error"
                                        ? "bg-(--danger)"
                                        : coreState === "loading"
                                            ? "bg-(--warning)"
                                            : status === "running"
                                        ? "bg-(--success)"
                                        : status === "paused"
                                            ? "bg-(--warning)"
                                            : "bg-(--muted)",
                                ].join(" ")} />
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold">
                                        {romName !== "-" ? romName : "No ROM loaded"}
                                    </div>
                                    <div className="text-[11px] text-(--muted)">
                                        {coreState === "loading"
                                            ? "Core loading"
                                            : coreState === "error"
                                                ? "Core unavailable"
                                                : status === "running"
                                                    ? "Running"
                                                    : status === "paused"
                                                        ? "Paused"
                                                        : "Ready"}
                                        {romHashState ? ` · #${romHashState.slice(0, 8)}` : ""}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAudioEnabled((enabled) => !enabled)}
                                    className="rounded-xl border border-(--border) px-3 py-2 text-xs font-bold transition hover:bg-(--panel-2)"
                                >
                                    Audio {audioEnabled ? "On" : "Off"}
                                </button>
                                <button
                                    type="button"
                                    onClick={onToggleRun}
                                    disabled={status === "idle"}
                                    className="rounded-xl bg-(--accent) px-4 py-2 text-xs font-bold text-(--accent-text) transition disabled:opacity-40"
                                >
                                    {status === "running" ? "Pause" : "Resume"}
                                </button>
                                <button
                                    type="button"
                                    onClick={onFullscreen}
                                    disabled={status === "idle"}
                                    className="rounded-xl border border-(--border) px-3 py-2 text-xs font-bold transition hover:bg-(--panel-2) disabled:opacity-40"
                                >
                                    Fullscreen
                                </button>
                            </div>
                        </div>
                    )}

                    <GbaConsole
                        canvasRef={canvasRef}
                        status={status}
                        focusMode={menuHidden}
                    />

                    {phoneControllerState.status !== "connected" && (
                        <MobileControls onPress={press} onRelease={release} />
                    )}

                    {!menuHidden && (
                        <div
                            className="mt-4 hidden text-xs leading-relaxed text-(--muted) lg:block"
                            role="status"
                        >
                            {message}
                        </div>
                    )}
                </div>

                {!menuHidden && tab === "library" && <RomLibrary onPlay={loadRomFromLibrary} />}
            </main>

            <EmulatorQuickMenu
                open={showQuickMenu}
                systemLabel="Game Boy Advance"
                status={status}
                romName={romName}
                slot={autoSaveSlot}
                audioEnabled={audioEnabled}
                onClose={() => setShowQuickMenu(false)}
                onToggleRun={() => {
                    onToggleRun();
                    setShowQuickMenu(false);
                }}
                onSave={() => {
                    void onSave(autoSaveSlot);
                    setShowQuickMenu(false);
                }}
                onLoad={() => {
                    void onLoad(autoSaveSlot);
                    setShowQuickMenu(false);
                }}
                onReset={() => {
                    onReset();
                    setShowQuickMenu(false);
                }}
                onScreenshot={() => {
                    onScreenshot();
                    setShowQuickMenu(false);
                }}
                onFullscreen={() => {
                    onFullscreen();
                    setShowQuickMenu(false);
                }}
                onToggleAudio={() => setAudioEnabled((enabled) => !enabled)}
                phoneControllerStatus={phoneControllerState.status}
                onOpenPhoneController={() => {
                    setShowQuickMenu(false);
                    setShowPhoneController(true);
                    if (
                        phoneControllerState.status === "idle" ||
                        phoneControllerState.status === "error"
                    ) {
                        void startPhonePairing();
                    }
                }}
                onOpenSettings={openSettings}
                onEject={() => {
                    setShowQuickMenu(false);
                    setShowEjectConfirm(true);
                }}
            />

            <PhoneControllerDialog
                open={showPhoneController}
                systemLabel="Game Boy Advance"
                state={phoneControllerState}
                onClose={() => setShowPhoneController(false)}
                onStart={() => void startPhonePairing()}
                onStop={stopPhonePairing}
            />

            <SettingsPanel
                show={showSettings}
                open={settingsOpen}
                onClose={closeSettings}
                canInteract={canInteract}
                romHash={romHashState}
                saveVersion={saveVersion}
                onSave={onSave}
                onLoad={onLoad}
                onExportSave={onExportSave}
                onImportSave={onImportSave}
                turbo={turbo as TurboRate}
                setTurbo={setTurbo}
                autoSaveEnabled={autoSaveEnabled}
                setAutoSaveEnabled={setAutoSaveEnabled}
                autoSaveSlot={autoSaveSlot}
                setAutoSaveSlot={setAutoSaveSlot}
                keymap={keymap}
                onSetKey={setKeymapKey}
                onResetKeymap={resetKeymap}
            />

            <ConfirmDialog
                open={showEjectConfirm}
                title="Eject ROM"
                message={`Remove "${romName}" from the emulator? Your save states in the library are kept.`}
                confirmLabel="Eject"
                danger
                onConfirm={() => {
                    setShowEjectConfirm(false);
                    onEject();
                }}
                onCancel={() => setShowEjectConfirm(false)}
            />
        </div>
    );
}
