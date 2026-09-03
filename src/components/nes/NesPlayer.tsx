/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createJsnesCore, type NesCore } from "@/lib/nes/core-adapter";
import { useKeyboardInput } from "@/lib/hooks/useKeyboardInput";
import { useGamepadInput } from "@/lib/hooks/useGamepadInput";
import { useKeymap } from "@/lib/hooks/useKeymap";
import { useNesAutoSaveOnClose } from "@/lib/hooks/useNesAutoSaveOnClose";
import type { NesButton } from "@/lib/nes/input";
import { defaultNesKeymap } from "@/lib/nes/input";
import { defaultNesGamepadMapping } from "@/lib/nes/gamepad";
import type { Slot } from "@/lib/storage/nesSaveStateStore";

import ThemeToggle from "@/components/ThemeToggle";
import { NesConsole } from "@/components/nes/NesConsole";
import { NesMobileControls } from "@/components/nes/MobileControls";
import { NesSettingsPanel } from "@/components/nes/NesSettingsPanel";
import { ConfirmDialog } from "@/components/nes/ConfirmDialog";
import { EmulatorQuickMenu } from "@/components/emulator/QuickMenu";
import { PhoneControllerDialog } from "@/components/emulator/PhoneControllerDialog";
import { NesRomLibrary } from "@/components/nes/NesRomLibrary";
import Link from "next/link";

import {
    getNesRomBytes,
    touchNesLastPlayed,
    setNesCoverArt,
} from "@/lib/storage/nesRomStore";
import {
    putNesSaveState,
    getNesSaveState,
    putNesMeta,
} from "@/lib/storage/nesSaveStateStore";
import { usePhoneController } from "@/lib/hooks/usePhoneController";

type Tab = "emulator" | "library";

const NES_PHONE_BUTTONS: readonly NesButton[] = [
    "UP",
    "DOWN",
    "LEFT",
    "RIGHT",
    "A",
    "B",
    "START",
    "SELECT",
];

export default function NesPlayer() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const coreRef = useRef<NesCore | null>(null);

    const [tab, setTab] = useState<Tab>("emulator");
    const [romName, setRomName] = useState("-");
    const [romHashState, setRomHashState] = useState("");
    const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
    const [coreState, setCoreState] = useState<"loading" | "ready" | "error">("loading");
    const [message, setMessage] = useState(
        "Open Library to add or choose a .nes ROM.",
    );

    const [gamepadInfo, setGamepadInfo] = useState("No controller");
    const [showSettings, setShowSettings] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showQuickMenu, setShowQuickMenu] = useState(false);
    const [showPhoneController, setShowPhoneController] = useState(false);
    const [showEjectConfirm, setShowEjectConfirm] = useState(false);

    const [audioEnabled, setAudioEnabled] = useState(true);
    const audioEnabledRef = useRef(true);

    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
    const [autoSaveSlot, setAutoSaveSlot] = useState<Slot>(1);
    const [saveVersion, setSaveVersion] = useState(0);
    const [menuHidden, setMenuHidden] = useState(false);

    useEffect(() => {
        audioEnabledRef.current = audioEnabled;
        coreRef.current?.setAudioEnabled?.(audioEnabled);
    }, [audioEnabled]);

    const { keymap, setKey: setKeymapKey, resetToDefaults: resetKeymap } = useKeymap<NesButton>("nes:keymap", defaultNesKeymap);
    const {
        state: phoneControllerState,
        startPairing: startPhonePairing,
        stopPairing: stopPhonePairing,
    } = usePhoneController({
        coreRef,
        system: "nes",
        buttons: NES_PHONE_BUTTONS,
    });

    const gameplayInputEnabled =
        !showQuickMenu &&
        !showSettings &&
        !showPhoneController &&
        !showEjectConfirm;
    useKeyboardInput(coreRef, keymap, gameplayInputEnabled);
    useGamepadInput(coreRef, defaultNesGamepadMapping, setGamepadInfo, gameplayInputEnabled);

    useNesAutoSaveOnClose({
        coreRef,
        romHash: romHashState,
        romName,
        enabled: autoSaveEnabled,
        slot: autoSaveSlot,
        setMessage,
        onSaveVersion: () => setSaveVersion((v) => v + 1),
    });

    // init core
    useEffect(() => {
        let core: NesCore | null = null;

        try {
            core = createJsnesCore();
            coreRef.current = core;
            const canvas = canvasRef.current;
            if (canvas) core.attachCanvas(canvas);
            core.setAudioEnabled?.(audioEnabledRef.current);
            setCoreState("ready");
            setMessage("NES core ready. Open Library to choose a ROM.");
        } catch (error) {
            console.error(error);
            setCoreState("error");
            setMessage(
                `Failed to init core: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        return () => {
            core?.pause();
            core?.destroy();
        };
    }, []);

    const canInteract = useMemo(() => status !== "idle", [status]);

    function saveCoverArt() {
        if (!romHashState || !canvasRef.current) return;
        try {
            const url = canvasRef.current.toDataURL("image/png");
            setNesCoverArt(romHashState, url);
        } catch { /* ignore */ }
    }

    const loadRomFromLibrary = useCallback(
        async (romHash: string, name: string) => {
            if (coreState !== "ready") {
                setMessage(
                    coreState === "loading"
                        ? "NES core is still loading."
                        : "NES core is unavailable. Reload the page and try again.",
                );
                return;
            }

            saveCoverArt();
            const bytes = await getNesRomBytes(romHash);
            if (!bytes) { setMessage("ROM not found in library."); return; }

            setRomName(name);
            setRomHashState(romHash);
            touchNesLastPlayed(romHash);
            setTab("emulator");
            setMessage(`ROM loaded: ${name} (${bytes.length.toLocaleString()} bytes)`);

            try {
                coreRef.current?.loadRom(bytes, name);
                setStatus(coreRef.current?.status ?? "running");
                coreRef.current?.setAudioEnabled?.(audioEnabledRef.current);
            } catch (err: any) {
                console.error(err);
                setMessage(`Failed to start core: ${err?.message ?? String(err)}`);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [coreState, romHashState],
    );

    function onToggleRun() {
        const c = coreRef.current;
        if (!c) return;
        if (c.status === "running") {
            c.pause();
            setStatus("paused");
            setMessage("Paused.");
        } else {
            c.start();
            setStatus("running");
            setMessage("Running.");
        }
    }

    function onReset() {
        const c = coreRef.current;
        if (!c) return;

        try {
            c.reset();
            setStatus(c.status);
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
        saveCoverArt();
        c.pause();
        c.setAudioEnabled?.(false);
        setStatus("idle");
        setRomName("-");
        setRomHashState("");
        setMessage("ROM ejected. Open Library to choose another ROM.");
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        }
    }

    async function onSave(slot: Slot) {
        if (!coreRef.current || !romHashState) { setMessage("Load a ROM first."); return; }
        const data = coreRef.current.saveState();
        if (!data) { setMessage("Save failed."); return; }
        await putNesSaveState(romHashState, slot, data);
        await putNesMeta({ romHash: romHashState, romName, updatedAt: Date.now(), lastSlot: slot });
        setSaveVersion((v) => v + 1);
        setMessage(`Saved state to slot ${slot}.`);
    }

    async function onLoad(slot: Slot) {
        if (!coreRef.current || !romHashState) { setMessage("Load a ROM first."); return; }
        const data = await getNesSaveState(romHashState, slot);
        if (!data) { setMessage(`No save data in slot ${slot}.`); return; }
        coreRef.current.loadState(data);
        setMessage(`Loaded state from slot ${slot}.`);
    }

    async function onExportSave(slot: Slot) {
        if (!romHashState) return;
        const data = await getNesSaveState(romHashState, slot);
        if (!data) { setMessage(`No save data in slot ${slot}.`); return; }
        const blob = new Blob([data], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${romName.replace(/\.[^/.]+$/, "")}_slot${slot}.sav`;
        a.click();
        URL.revokeObjectURL(a.href);
        setMessage(`Exported slot ${slot}.`);
    }

    async function onImportSave(slot: Slot, file: File) {
        if (!romHashState) return;
        try {
            const text = await file.text();
            // Validate it's parseable JSON (NES saves are JSON-serialized)
            JSON.parse(text);
            await putNesSaveState(romHashState, slot, text);
            await putNesMeta({ romHash: romHashState, romName, updatedAt: Date.now(), lastSlot: slot });
            setSaveVersion((v) => v + 1);
            setMessage(`Imported save to slot ${slot}.`);
        } catch {
            setMessage("Import failed — invalid save file.");
        }
    }

    function onFullscreen() { canvasRef.current?.requestFullscreen?.(); }

    function onScreenshot() {
        const c = canvasRef.current;
        if (!c) return;
        const url = c.toDataURL("image/png");
        if (romHashState) setNesCoverArt(romHashState, url);
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

    function press(btn: NesButton) { coreRef.current?.press(btn); }
    function release(btn: NesButton) { coreRef.current?.release(btn); }

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
                                NES
                            </Link>
                            <div className="min-w-0">
                                <div className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-(--accent) lg:block">
                                    JSNES core
                                </div>
                                <h1 className="truncate text-sm font-black tracking-tight lg:text-xl">
                                    Nintendo NES
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

                    <NesConsole
                        canvasRef={canvasRef}
                        status={status}
                        focusMode={menuHidden}
                    />

                    {phoneControllerState.status !== "connected" && (
                        <NesMobileControls onPress={press} onRelease={release} />
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

                {!menuHidden && tab === "library" && <NesRomLibrary onPlay={loadRomFromLibrary} />}
            </main>

            <EmulatorQuickMenu
                open={showQuickMenu}
                systemLabel="Nintendo NES"
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
                systemLabel="Nintendo NES"
                state={phoneControllerState}
                onClose={() => setShowPhoneController(false)}
                onStart={() => void startPhonePairing()}
                onStop={stopPhonePairing}
            />

            <NesSettingsPanel
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
