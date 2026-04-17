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
import { NesRomLibrary } from "@/components/nes/NesRomLibrary";
import Link from "next/link";

import {
    getNesRomBytes,
    touchNesLastPlayed,
    setNesCoverArt,
    upsertNesRomEntry,
    putNesRomBytes,
} from "@/lib/storage/nesRomStore";
import {
    putNesSaveState,
    getNesSaveState,
    putNesMeta,
} from "@/lib/storage/nesSaveStateStore";
import { hashRom } from "@/lib/hashRom";

type Tab = "emulator" | "library";

export default function NesPlayer() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const coreRef = useRef<NesCore | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [tab, setTab] = useState<Tab>("emulator");
    const [romName, setRomName] = useState("-");
    const [romHashState, setRomHashState] = useState("");
    const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
    const [message, setMessage] = useState("Upload a .nes ROM to begin.");

    const [gamepadInfo, setGamepadInfo] = useState("No controller");
    const [showSettings, setShowSettings] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
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

    useKeyboardInput(coreRef, keymap);
    useGamepadInput(coreRef, defaultNesGamepadMapping, setGamepadInfo);

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
        const c = createJsnesCore();
        coreRef.current = c;
        const canvas = canvasRef.current;
        if (canvas) c.attachCanvas(canvas);
        c.setAudioEnabled?.(audioEnabledRef.current);
        setMessage("NES core ready. Upload a .nes ROM.");

        return () => {
            c.pause();
            c.destroy();
        };
    }, []);

    const canInteract = useMemo(() => status !== "idle", [status]);

    async function onUpload(file: File | null) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".nes")) {
            setMessage("Please upload a .nes file.");
            return;
        }

        const buf = await file.arrayBuffer();
        const romBytes = new Uint8Array(buf);
        const romHash = await hashRom(romBytes);

        await putNesRomBytes(romHash, romBytes);
        upsertNesRomEntry({
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
            coreRef.current?.loadRom(romBytes, file.name);
            setStatus(coreRef.current?.status ?? "running");
            coreRef.current?.setAudioEnabled?.(audioEnabledRef.current);
        } catch (err: any) {
            console.error(err);
            setMessage(`Failed to start core: ${err?.message ?? String(err)}`);
        }
    }

    function saveCoverArt() {
        if (!romHashState || !canvasRef.current) return;
        try {
            const url = canvasRef.current.toDataURL("image/png");
            setNesCoverArt(romHashState, url);
        } catch { /* ignore */ }
    }

    const loadRomFromLibrary = useCallback(
        async (romHash: string, name: string) => {
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
        [romHashState],
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
        c.reset();
        setStatus(c.status);
        setMessage("Reset.");
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
        setMessage("ROM ejected. Upload or pick a ROM to play.");
        if (fileInputRef.current) fileInputRef.current.value = "";
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
        setShowSettings(true);
        requestAnimationFrame(() => setSettingsOpen(true));
    }

    function closeSettings() {
        setSettingsOpen(false);
        window.setTimeout(() => setShowSettings(false), 220);
    }

    useEffect(() => {
        if (!showSettings) return;
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") closeSettings(); };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [showSettings]);

    // F2 shortcut to toggle menu visibility
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F2") {
                e.preventDefault();
                setMenuHidden((h) => !h);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    function press(btn: NesButton) { coreRef.current?.press(btn); }
    function release(btn: NesButton) { coreRef.current?.release(btn); }

    return (
        <div className={[
            "mx-auto w-full max-w-5xl",
            menuHidden ? "flex min-h-screen flex-col items-center justify-center" : "p-4 lg:p-6",
        ].join(" ")}>
            {/* Floating toggle button — always visible */}
            <button
                onClick={() => setMenuHidden((h) => !h)}
                className="fixed right-4 top-4 z-30 rounded-full border bg-(--panel) border-(--border) px-3 py-1.5 text-xs shadow-md hover:-translate-y-px transition"
                type="button"
                aria-label={menuHidden ? "Show menu" : "Hide menu"}
                title={`${menuHidden ? "Show" : "Hide"} menu (F2)`}
            >
                {menuHidden ? "☰ Show" : "✕ Hide"}
            </button>

            {/* Header */}
            <div className={[
                "mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
                menuHidden ? "hidden" : "",
            ].join(" ")}>
                <div>
                    <div className="text-2xl font-bold tracking-tight">NES Emulator</div>
                    <div className="text-sm text-(--muted)">Upload .nes → Play in browser (JSNES)</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link href="/" className="rounded-full border px-3 py-1 bg-(--panel) border-(--border) text-(--text) hover:-translate-y-px transition">← Home</Link>
                    <span className="rounded-full border px-3 py-1 bg-(--panel) border-(--border) text-(--text)">Controller: {gamepadInfo}</span>
                    <ThemeToggle />
                    <button onClick={openSettings} className="rounded-full border px-3 py-1 bg-(--panel) border-(--border) text-(--text) hover:-translate-y-px transition" type="button">⚙ Settings</button>
                </div>
            </div>

            {/* Tab bar */}
            <div className={[
                "mb-4 flex gap-1 rounded-(--radius) border bg-(--panel) border-(--border) p-1",
                menuHidden ? "hidden" : "",
            ].join(" ")}>
                {(["emulator", "library"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)} className={[
                        "flex-1 rounded-(--radius) px-4 py-2 text-sm font-medium transition",
                        tab === t ? "bg-(--accent) text-white shadow-sm" : "text-(--muted) hover:text-(--text)",
                    ].join(" ")} type="button">
                        {t === "emulator" ? "🎮 Emulator" : "📚 Library"}
                    </button>
                ))}
            </div>

            {/* Emulator */}
            <div className={tab !== "emulator" ? "hidden" : "w-full"}>
                {/* Controls bar */}
                <div className={[
                    "flex flex-wrap items-center justify-between gap-3",
                    menuHidden ? "hidden" : "",
                ].join(" ")}>
                    <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-(--text) truncate max-w-48">{romName !== "-" ? romName : "No ROM"}</div>
                        <div className={[
                            "h-2 w-2 rounded-full",
                            status === "running" ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]"
                                : status === "paused" ? "bg-yellow-400"
                                    : "bg-(--muted)/40",
                        ].join(" ")} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-(--panel) px-3 py-2 text-xs border-(--border)">
                            <input type="checkbox" className="h-4 w-4" checked={audioEnabled} onChange={(e) => setAudioEnabled(e.target.checked)} />
                            Audio
                        </label>
                        <button onClick={onToggleRun} className="rounded-xl border px-4 py-2 text-xs text-white disabled:opacity-50 transition active:translate-y-px border-(--border) bg-(--accent) hover:brightness-105" disabled={status === "idle"} type="button">{status === "running" ? "Pause" : "Run"}</button>
                        <button onClick={onReset} className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50" disabled={status === "idle"} type="button">Reset</button>
                        <button onClick={() => setShowEjectConfirm(true)} className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50 hover:text-red-500 transition" disabled={status === "idle"} type="button">Eject</button>
                        <button onClick={onFullscreen} className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50" disabled={status === "idle"} type="button">Fullscreen</button>
                        <button onClick={onScreenshot} className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50" disabled={status === "idle"} type="button">Screenshot</button>
                    </div>
                </div>

                {/* Screen — full width, no extra wrapper */}
                <NesConsole canvasRef={canvasRef} status={status} />

                {/* Mobile touch controls */}
                <NesMobileControls onPress={press} onRelease={release} />

                {/* Bottom row */}
                <div className={[
                    "mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                    menuHidden ? "hidden" : "",
                ].join(" ")}>
                    <div className="text-sm text-(--muted)">{message}</div>
                    <label className="inline-flex items-center gap-2">
                        <input ref={fileInputRef} type="file" accept=".nes" className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-(--panel-2) file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-(--panel-3)" onChange={(e) => { onUpload(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                    </label>
                </div>
            </div>

            {tab === "library" && <NesRomLibrary onPlay={loadRomFromLibrary} />}

            <NesSettingsPanel show={showSettings} open={settingsOpen} onClose={closeSettings} canInteract={canInteract} romHash={romHashState} saveVersion={saveVersion} onSave={onSave} onLoad={onLoad} onExportSave={onExportSave} onImportSave={onImportSave} autoSaveEnabled={autoSaveEnabled} setAutoSaveEnabled={setAutoSaveEnabled} autoSaveSlot={autoSaveSlot} setAutoSaveSlot={setAutoSaveSlot} keymap={keymap} onSetKey={setKeymapKey} onResetKeymap={resetKeymap} />

            <ConfirmDialog open={showEjectConfirm} title="Eject ROM" message={`Remove "${romName}" from the emulator? Your save states in the library are kept.`} confirmLabel="Eject" danger onConfirm={() => { setShowEjectConfirm(false); onEject(); }} onCancel={() => setShowEjectConfirm(false)} />
        </div>
    );
}
