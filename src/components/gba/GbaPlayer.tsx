/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMgbaWasmCore, type GbaCore } from "@/lib/gba/core-adapter";
import { useKeyboardInput } from "@/lib/hooks/useKeyboardInput";
import { useGamepadInput } from "@/lib/hooks/useGamepadInput";
import type { GbaButton } from "@/lib/input";

import ThemeToggle from "@/components/ThemeToggle";
import { GbaConsole } from "@/components/gba/GbaConsole";
import { SettingsPanel } from "@/components/gba/SettingsPanel";
import { RomLibrary } from "@/components/gba/RomLibrary";
import Link from "next/link";

import { useTurbo } from "@/lib/hooks/useTurbo";
import { TurboRate } from "@/lib/gba/core-adapter";
import { useTurboShortcuts } from "@/lib/hooks/useTurboShortcuts";
import { useAutoSaveOnClose } from "@/lib/hooks/useAutoSaveOnClose";
import { useKeymap } from "@/lib/hooks/useKeymap";
import type { Slot } from "@/lib/storage/saveStateStore";
import { getRomBytes, touchLastPlayed, setCoverArt, upsertRomEntry, putRomBytes } from "@/lib/storage/romStore";

async function hashRom(bytes: Uint8Array): Promise<string> {
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const digest = await crypto.subtle.digest("SHA-256", ab);
    const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hex.slice(0, 16);
}

type Tab = "emulator" | "library";

export default function GbaPlayer() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const coreRef = useRef<GbaCore | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [tab, setTab] = useState<Tab>("emulator");
    const [romName, setRomName] = useState("-");
    const [romHashState, setRomHashState] = useState("");
    const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
    const [message, setMessage] = useState("Upload a .gba ROM to begin.");

    const [gamepadInfo, setGamepadInfo] = useState("No controller");
    const [showSettings, setShowSettings] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

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
    const { keymap, setKey: setKeymapKey, resetToDefaults: resetKeymap } = useKeymap();

    // inputs
    useKeyboardInput(coreRef, keymap);
    useGamepadInput(coreRef, setGamepadInfo);

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

                setMessage("mGBA core ready. Upload a .gba ROM.");
            } catch (err: any) {
                console.error(err);
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
        enabled: autoSaveEnabled && status !== "idle",
        slot: autoSaveSlot,
        setMessage,
    });

    async function onUpload(file: File | null) {
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".gba")) {
            setMessage("Please upload a .gba file.");
            return;
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
            await coreRef.current?.loadRom(romBytes, file.name);
            if (autoLoadOnRom) {
                try {
                    await coreRef.current?.loadState(autoSaveSlot);
                    setMessage(`ROM loaded: ${file.name} (auto-loaded slot ${autoSaveSlot})`);
                } catch {
                    // no save data yet, skip
                }
            }
            setStatus(coreRef.current?.status ?? "running");

            coreRef.current?.setAudioEnabled?.(audioEnabledRef.current);

            // re-apply turbo after load (core may reset speed)
            const c: any = coreRef.current;
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
            // save cover art of previous ROM
            saveCoverArt();

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
                await coreRef.current?.loadRom(bytes, name);
                if (autoLoadOnRom) {
                    try {
                        await coreRef.current?.loadState(autoSaveSlot);
                        setMessage(`ROM loaded: ${name} (auto-loaded slot ${autoSaveSlot})`);
                    } catch { /* no save yet */ }
                }
                setStatus(coreRef.current?.status ?? "running");
                coreRef.current?.setAudioEnabled?.(audioEnabledRef.current);

                const c: any = coreRef.current;
                if (typeof c?.setTurbo === "function") c.setTurbo(turbo);
                else if (typeof c?.setSpeedMultiplier === "function") c.setSpeedMultiplier(turbo);
            } catch (err: any) {
                console.error(err);
                setMessage(`Failed to start core: ${err?.message ?? String(err)}`);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [autoLoadOnRom, autoSaveSlot, turbo, romHashState],
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

        c.reset();
        setStatus(c.status);
        c.setAudioEnabled?.(audioEnabledRef.current);
        setMessage("Reset.");
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
        const c: any = coreRef.current;
        if (!c) return;
        if (!romHashState) {
            setMessage("Load a ROM first.");
            return;
        }

        try {
            // use bytes API if available (preferred)
            if (typeof c.saveStateBytes === "function") {
                const bytes: Uint8Array = await c.saveStateBytes(slot);
                const { putSaveState, putMeta } = await import("@/lib/storage/saveStateStore");
                putSaveState(romHashState, slot, bytes);
                putMeta({ romHash: romHashState, romName, updatedAt: Date.now(), lastSlot: slot });
            } else {
                // fallback: use core's internal save
                await c.saveState(slot);
            }
            setMessage(`Saved state to slot ${slot}.`);
        } catch (err: any) {
            console.error(err);
            setMessage(`Save failed: ${err?.message ?? String(err)}`);
        }
    }

    async function onLoad(slot: Slot) {
        const c: any = coreRef.current;
        if (!c) return;
        if (!romHashState) {
            setMessage("Load a ROM first.");
            return;
        }

        try {
            // load bytes from localStorage if core supports it
            if (typeof c.loadStateBytes === "function") {
                const { getSaveState } = await import("@/lib/storage/saveStateStore");
                const bytes = getSaveState(romHashState, slot);
                if (!bytes) {
                    setMessage(`No save data in slot ${slot}.`);
                    return;
                }
                await c.loadStateBytes(slot, bytes);
            } else {
                // fallback to core's internal load
                await c.loadState(slot);
            }

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
        setShowSettings(true);
        requestAnimationFrame(() => setSettingsOpen(true));
    }

    function closeSettings() {
        setSettingsOpen(false);
        window.setTimeout(() => setShowSettings(false), 220);
    }

    useEffect(() => {
        if (!showSettings) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeSettings();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [showSettings]);

    function press(btn: GbaButton) {
        coreRef.current?.press(btn);
    }
    function release(btn: GbaButton) {
        coreRef.current?.release(btn);
    }

    return (
        <div className="mx-auto w-full max-w-4xl p-4 lg:p-6">
            {/* Header */}
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="text-2xl font-bold tracking-tight">GBA Emulator</div>
                    <div className="text-sm text-(--muted)">Upload .gba → Play in browser (mGBA WASM)</div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                        href="/"
                        className="rounded-full border px-3 py-1 bg-(--panel) border-(--border) text-(--text) hover:-translate-y-px transition"
                    >
                        ← Home
                    </Link>

                    <span className="rounded-full border px-3 py-1 bg-(--panel) border-(--border) text-(--text)">
                        Controller: {gamepadInfo}
                    </span>

                    <ThemeToggle />

                    <button
                        onClick={openSettings}
                        className="rounded-full border px-3 py-1 bg-(--panel) border-(--border) text-(--text) hover:-translate-y-px transition"
                        type="button"
                    >
                        ⚙ Settings
                    </button>
                </div>
            </div>

            {/* Tab bar */}
            <div className="mb-4 flex gap-1 rounded-(--radius) border bg-(--panel) border-(--border) p-1">
                {(["emulator", "library"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={[
                            "flex-1 rounded-(--radius) px-4 py-2 text-sm font-medium transition",
                            tab === t
                                ? "bg-(--accent) text-white shadow-sm"
                                : "text-(--muted) hover:text-(--text)",
                        ].join(" ")}
                        type="button"
                    >
                        {t === "emulator" ? "🎮 Emulator" : "📚 Library"}
                    </button>
                ))}
            </div>

            {/* Emulator — always mounted, hidden when on library tab */}
            <div className={tab !== "emulator" ? "hidden" : ""}>
                {/* Centered Console */}
                <div className="flex justify-center">
                    <div className="w-full rounded-(--radius) border bg-(--panel) border-(--border) p-4 lg:p-5 shadow-(--shadow) retro-noise">
                        {/* Top controls */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-40">
                                <div className="text-sm font-medium text-(--muted)">ROM: {romName}</div>
                                <div className="text-xs uppercase tracking-wide text-(--muted)">Status</div>
                                <div className="text-xs text-(--muted)">
                                    {status === "idle" ? "Idle" : status === "running" ? "Running" : "Paused"}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-(--panel) px-3 py-2 text-xs border-(--border)">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={audioEnabled}
                                        onChange={(e) => setAudioEnabled(e.target.checked)}
                                    />
                                    Audio
                                </label>

                                <button
                                    onClick={onToggleRun}
                                    className="rounded-xl border px-4 py-2 text-xs text-white disabled:opacity-50 transition active:translate-y-px border-(--border) bg-(--accent) hover:brightness-105"
                                    disabled={status === "idle"}
                                    type="button"
                                >
                                    {status === "running" ? "Pause" : "Run"}
                                </button>

                                <button
                                    onClick={onReset}
                                    className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50"
                                    disabled={status === "idle"}
                                    type="button"
                                >
                                    Reset
                                </button>

                                <button
                                    onClick={onEject}
                                    className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50 hover:text-red-500 transition"
                                    disabled={status === "idle"}
                                    type="button"
                                >
                                    Eject
                                </button>

                                <button
                                    onClick={onFullscreen}
                                    className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50"
                                    disabled={status === "idle"}
                                    type="button"
                                >
                                    Fullscreen
                                </button>

                                <button
                                    onClick={onScreenshot}
                                    className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50"
                                    disabled={status === "idle"}
                                    type="button"
                                >
                                    Screenshot
                                </button>
                            </div>
                        </div>

                        {/* Screen */}
                        <GbaConsole canvasRef={canvasRef} status={status} onPress={press} onRelease={release} />

                        {/* Bottom row */}
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-(--muted)">{message}</div>

                            <label className="inline-flex items-center gap-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".gba"
                                    className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-(--panel-2) file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-(--panel-3)"
                                    onChange={(e) => {
                                        onUpload(e.target.files?.[0] ?? null);
                                        // reset so the same file can be re-selected
                                        e.target.value = "";
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Library — only rendered when on library tab */}
            {tab === "library" && <RomLibrary onPlay={loadRomFromLibrary} />}

            {/* Settings */}
            <SettingsPanel
                show={showSettings}
                open={settingsOpen}
                onClose={closeSettings}
                canInteract={canInteract}
                onSave={onSave}
                onLoad={onLoad}
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
        </div>
    );
}