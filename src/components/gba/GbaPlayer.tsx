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
import { RomLibrary } from "@/components/gba/RomLibrary";
import Link from "next/link";

import { useTurbo } from "@/lib/hooks/useTurbo";
import { TurboRate } from "@/lib/gba/core-adapter";
import { useTurboShortcuts } from "@/lib/hooks/useTurboShortcuts";
import { useAutoSaveOnClose } from "@/lib/hooks/useAutoSaveOnClose";
import { useKeymap } from "@/lib/hooks/useKeymap";
import { defaultKeymap } from "@/lib/input";
import { hashRom } from "@/lib/hashRom";
import { getSaveState, type Slot } from "@/lib/storage/saveStateStore";
import { getRomBytes, touchLastPlayed, setCoverArt, upsertRomEntry, putRomBytes } from "@/lib/storage/romStore";

type Tab = "emulator" | "library";

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
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [tab, setTab] = useState<Tab>("emulator");
    const [romName, setRomName] = useState("-");
    const [romHashState, setRomHashState] = useState("");
    const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
    const [coreState, setCoreState] = useState<"loading" | "ready" | "error">("loading");
    const [message, setMessage] = useState("Upload a .gba ROM to begin.");

    const [gamepadInfo, setGamepadInfo] = useState("No controller");
    const [showSettings, setShowSettings] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showQuickMenu, setShowQuickMenu] = useState(false);
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

    // inputs
    const gameplayInputEnabled = !showQuickMenu && !showSettings && !showEjectConfirm;
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
                setMessage("mGBA core ready. Upload a .gba ROM.");
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

    async function onUpload(file: File | null) {
        if (!file) return;

        if (coreState !== "ready") {
            setMessage(
                coreState === "loading"
                    ? "mGBA core is still loading."
                    : "mGBA core is unavailable. Reload the page and try again.",
            );
            return;
        }

        if (!file.name.toLowerCase().endsWith(".gba")) {
            setMessage("Please upload a .gba file.");
            return;
        }

        // stop current game before loading a new one
        const prev = coreRef.current;
        if (prev && prev.status !== "idle") {
            saveCoverArt();
            prev.pause();
            prev.setAudioEnabled?.(false);
        }

        const buf = await file.arrayBuffer();
        const romBytes = new Uint8Array(buf);

        const romHash = await hashRom(romBytes);

        // save to library automatically
        await putRomBytes(romHash, romBytes);
        upsertRomEntry({
            romHash,
            name: file.name,
            size: romBytes.length,
            addedAt: Date.now(),
            lastPlayedAt: Date.now(),
        });

        setRomName(file.name);
        setRomHashState(romHash);
        setMessage(`ROM loaded: ${file.name} (${romBytes.length.toLocaleString()} bytes)`);

        try {
            const core = coreRef.current;
            if (!core) throw new Error("mGBA core is not ready.");

            await core.loadRom(romBytes, file.name);
            let loadedMessage = `ROM loaded: ${file.name} (${romBytes.length.toLocaleString()} bytes)`;
            if (autoLoadOnRom) {
                try {
                    if (await loadPortableState(core, romHash, autoSaveSlot)) {
                        loadedMessage = `ROM loaded: ${file.name} (auto-loaded slot ${autoSaveSlot})`;
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

            // re-apply turbo after load (core may reset speed)
            const c: any = core;
            if (typeof c?.setTurbo === "function") c.setTurbo(turbo);
            else if (typeof c?.setSpeedMultiplier === "function") c.setSpeedMultiplier(turbo);
        } catch (err: any) {
            console.error(err);
            setMessage(`Failed to start core: ${err?.message ?? String(err)}`);
        }
    }

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
        setMessage("ROM ejected. Upload or pick a ROM to play.");

        // reset file input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";

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
                    className="fixed right-4 top-4 z-30 rounded-xl border border-(--border) bg-(--panel-translucent) px-3 py-2 text-xs font-bold shadow-(--shadow) backdrop-blur transition hover:border-(--accent-border)"
                    type="button"
                    title="Show interface (F2)"
                >
                    Show interface
                </button>
            ) : (
                <header className="sticky top-0 z-30 border-b border-(--border) bg-(--bg-translucent) backdrop-blur-xl">
                    <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center gap-3">
                            <Link
                                href="/"
                                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-(--accent) text-xs font-black text-(--accent-text) shadow-(--accent-shadow)"
                                aria-label="Back to systems"
                                title="Back to systems"
                            >
                                GBA
                            </Link>
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-(--accent)">
                                    mGBA core
                                </div>
                                <h1 className="truncate text-lg font-black tracking-tight sm:text-xl">
                                    Game Boy Advance
                                </h1>
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            <span className="hidden max-w-52 truncate rounded-xl border border-(--border) bg-(--panel) px-3 py-2 text-xs text-(--muted) md:block">
                                {gamepadInfo}
                            </span>
                            <ThemeToggle />
                            <button
                                type="button"
                                onClick={() => setShowQuickMenu(true)}
                                className="rounded-xl border border-(--border) bg-(--panel) px-3 py-2.5 text-xs font-bold transition hover:border-(--accent-border) hover:bg-(--panel-2)"
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
                    ? "flex min-h-screen max-w-7xl items-center px-4 sm:px-6 lg:px-8"
                    : "max-w-7xl px-4 pb-8 pt-5 sm:px-6 lg:px-8",
            ].join(" ")}>
                {!menuHidden && (
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex rounded-xl border border-(--border) bg-(--panel) p-1">
                            {(["emulator", "library"] as const).map((nextTab) => (
                                <button
                                    key={nextTab}
                                    onClick={() => setTab(nextTab)}
                                    className={[
                                        "rounded-lg px-4 py-2 text-xs font-bold transition",
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
                            className="rounded-xl border border-(--border) bg-(--panel) px-3 py-2 text-xs font-bold text-(--muted) transition hover:border-(--accent-border) hover:text-(--text)"
                            title="Hide interface (F2)"
                        >
                            Focus mode
                        </button>
                    </div>
                )}

                <div className={tab !== "emulator" ? "hidden" : "w-full"}>
                    {!menuHidden && (
                        <div className="flex flex-col gap-3 rounded-2xl border border-(--border) bg-(--panel) p-3 sm:flex-row sm:items-center sm:justify-between">
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

                    <GbaConsole canvasRef={canvasRef} status={status} />

                    {!menuHidden && (
                        <>
                            <MobileControls onPress={press} onRelease={release} />

                            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-(--border) bg-(--panel) p-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs leading-relaxed text-(--muted)" role="status">
                                    {message}
                                </div>
                                <div className="shrink-0">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".gba"
                                        className="hidden"
                                        onChange={(event) => {
                                            onUpload(event.target.files?.[0] ?? null);
                                            event.target.value = "";
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={coreState !== "ready"}
                                        className="rounded-xl bg-(--accent) px-4 py-2 text-xs font-bold text-(--accent-text) transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {coreState === "loading" ? "Loading core" : "Load ROM"}
                                    </button>
                                </div>
                            </div>
                        </>
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
                onOpenSettings={openSettings}
                onEject={() => {
                    setShowQuickMenu(false);
                    setShowEjectConfirm(true);
                }}
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
