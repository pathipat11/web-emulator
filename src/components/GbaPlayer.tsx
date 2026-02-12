/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createMgbaWasmCore, type GbaCore } from "@/lib/gba/core-adapter";
import { useKeyboardInput } from "@/lib/hooks/useKeyboardInput";
import { useGamepadInput } from "@/lib/hooks/useGamepadInput";
import type { GbaButton } from "@/lib/input";
import ThemeToggle from "@/components/ThemeToggle";

type Slot = 1 | 2 | 3;

async function hashRom(bytes: Uint8Array): Promise<string> {
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const digest = await crypto.subtle.digest("SHA-256", ab);
    const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hex.slice(0, 16);
}

export default function GbaPlayer() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const coreRef = useRef<GbaCore | null>(null);

    const [romName, setRomName] = useState("-");
    const [romHashState, setRomHashState] = useState("");
    const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
    const [message, setMessage] = useState("Upload a .gba ROM to begin.");

    const [gamepadInfo, setGamepadInfo] = useState("No controller");
    const [showSettings, setShowSettings] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // audio state (fix: pause/start/reset won't override muted state)
    const [audioEnabled, setAudioEnabled] = useState(true);
    const audioEnabledRef = useRef(true);

    useEffect(() => {
        audioEnabledRef.current = audioEnabled;
        coreRef.current?.setAudioEnabled?.(audioEnabled);
    }, [audioEnabled]);

    // inputs
    useKeyboardInput(coreRef);
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

                // enforce current audio preference
                c.setAudioEnabled?.(audioEnabledRef.current);

                setMessage("mGBA core ready. Upload a .gba ROM.");
            } catch (err: any) {
                console.error(err);
                setMessage(`Failed to init core: ${err?.message ?? String(err)}`);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const canInteract = useMemo(() => status !== "idle", [status]);

    async function onUpload(file: File | null) {
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".gba")) {
            setMessage("Please upload a .gba file.");
            return;
        }

        const buf = await file.arrayBuffer();
        const romBytes = new Uint8Array(buf);

        const romHash = await hashRom(romBytes);
        setRomName(file.name);
        setRomHashState(romHash);
        setMessage(`ROM loaded: ${file.name} (${romBytes.length.toLocaleString()} bytes)`);

        try {
            await coreRef.current?.loadRom(romBytes, file.name);
            setStatus(coreRef.current?.status ?? "running");

            // apply audio state after loading game
            coreRef.current?.setAudioEnabled?.(audioEnabledRef.current);
        } catch (err: any) {
            console.error(err);
            setMessage(`Failed to start core: ${err?.message ?? String(err)}`);
        }
    }

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

    async function onSave(slot: Slot) {
        const c = coreRef.current;
        if (!c) return;
        if (!romHashState) {
            setMessage("Load a ROM first.");
            return;
        }

        try {
            await c.saveState(slot);
            setMessage(`Saved state to slot ${slot}.`);
        } catch (err: any) {
            console.error(err);
            setMessage(`Save failed: ${err?.message ?? String(err)}`);
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
        const a = document.createElement("a");
        a.href = url;
        a.download = `${romName.replace(/\.[^/.]+$/, "") || "screenshot"}.png`;
        a.click();
    }

    function openSettings() {
        setShowSettings(true);
        requestAnimationFrame(() => {
            setSettingsOpen(true);
        });
    }

    function closeSettings() {
        setSettingsOpen(false);
        window.setTimeout(() => {
            setShowSettings(false);
        }, 220);
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
                    <div className="text-sm text-zinc-600">Upload .gba → Play in browser (mGBA WASM)</div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full border px-3 py-1 bg-(--panel) border-(--border) text-(--text)">
                        Controller: {gamepadInfo}
                    </span>

                    <ThemeToggle />

                    <button
                        onClick={openSettings}
                        className="rounded-full border px-3 py-1 bg-(--panel) border-(--border) text-(--text) hover:-translate-y-px transition"
                    >
                        ⚙ Settings
                    </button>
                </div>
            </div>

            {/* Centered Console */}
            <div className="flex justify-center">
                <div className="w-full rounded-(--radius) border bg-(--panel) border-(--border) p-4 lg:p-5 shadow-(--shadow) retro-noise">
                    {/* Top controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-40">
                            <div className="text-sm font-medium text-zinc-500">ROM: {romName}</div>
                            <div className="text-xs uppercase tracking-wide text-zinc-500">Status</div>
                            <div className="text-xs text-zinc-500">
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
                            >
                                {status === "running" ? "Pause" : "Run"}
                            </button>

                            <button
                                onClick={onReset}
                                className="rounded-xl border px-4 py-2 text-xs disabled:opacity-50"
                                disabled={status === "idle"}
                            >
                                Reset
                            </button>

                            <button
                                onClick={onFullscreen}
                                className="rounded-xl border px-4 py-2 text-xs disabled:opacity-50"
                                disabled={status === "idle"}
                            >
                                Fullscreen
                            </button>

                            <button
                                onClick={onScreenshot}
                                className="rounded-xl border px-4 py-2 text-xs disabled:opacity-50"
                                disabled={status === "idle"}
                            >
                                Screenshot
                            </button>
                        </div>
                    </div>

                    {/* Console shell */}
                    <div className="mt-5">
                        <div className="mx-auto w-full max-w-180">
                            <div className="rounded-[40px] border border-(--border) p-6 shadow-xl">
                                <div className="rounded-4xl bg-(--panel-2) p-5 shadow-inner">
                                    <div
                                        className="relative mx-auto w-full overflow-hidden rounded-3xl bg-(--screen) scanlines"
                                        style={{ boxShadow: `0 0 0 1px rgba(255,255,255,.06), 0 0 32px var(--screen-glow)` }}
                                    >
                                        <div className="aspect-3/2 w-full">
                                            <canvas
                                                ref={canvasRef}
                                                width={240}
                                                height={160}
                                                className="h-full w-full pixel-perfect"
                                            />
                                        </div>

                                        {/* paused overlay */}
                                        {status === "paused" && (
                                            <div className="absolute inset-0 grid place-items-center bg-black/50">
                                                <div className="rounded-2xl bg-black/70 px-4 py-2 text-sm font-semibold text-white">
                                                    PAUSED
                                                </div>
                                            </div>
                                        )}

                                        {/* Mobile overlay controls */}
                                        <div className="pointer-events-none absolute inset-0 lg:hidden">
                                            <div className="pointer-events-auto absolute bottom-3 left-3">
                                                <DPad onPress={press} onRelease={release} />
                                            </div>

                                            <div className="pointer-events-auto absolute bottom-3 right-3">
                                                <ABCluster onPress={press} onRelease={release} />
                                            </div>

                                            <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2">
                                                <StartSelect onPress={press} onRelease={release} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="text-sm font-semibold tracking-wide text-zinc-500">GBA</div>
                                        <div className="text-xs text-zinc-400">240×160 • Pixel Perfect</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom row */}
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-zinc-600">{message}</div>

                        <label className="inline-flex items-center gap-2">
                            <input
                                type="file"
                                accept=".gba"
                                className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-(--panel-2) file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-(--panel-3)"
                                onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Settings Slide-over */}
            {showSettings && (
                <>
                    <div
                        className={[
                            "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
                            settingsOpen ? "opacity-100" : "opacity-0",
                        ].join(" ")}
                        onClick={closeSettings}
                    />

                    {/* Panel (slide) */}
                    <div
                        className={[
                            "fixed right-0 top-0 z-50 h-full w-90 max-w-[90vw] bg-(--panel) p-6 shadow-(--shadow-2) overflow-y-auto border-l border-(--border)",
                            "transition-transform duration-200 ease-out will-change-transform",
                            settingsOpen ? "translate-x-0" : "translate-x-full",
                        ].join(" ")}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Settings</h2>
                            <button onClick={closeSettings} className="text-sm text-(--muted)">
                                ✕
                            </button>
                        </div>

                        <div className="mt-4 rounded-2xl bg-(--panel-2) p-3 text-sm text-(--text)">
                            <div className="font-medium">Tips</div>
                            • ต่อจอยแล้วกดปุ่มได้ทันที (Gamepad API) <br />
                            • มือถือ: ปุ่ม overlay อยู่บนจอ (กดค้างได้)
                        </div>

                        <div className="mt-6">
                            <div className="text-base font-semibold">Save / Load</div>
                            <div className="mt-3 space-y-2">
                                {[1, 2, 3].map((s) => (
                                    <div key={s} className="flex items-center justify-between rounded-2xl border p-3">
                                        <div className="font-medium">Slot {s}</div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onSave(s as Slot)}
                                                className="rounded-xl bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                                                disabled={!canInteract}
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => onLoad(s as Slot)}
                                                className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
                                                disabled={!canInteract}
                                            >
                                                Load
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="text-base font-semibold">Keyboard Controls</div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                <KeyRow k="Arrow Keys" v="D-Pad" />
                                <KeyRow k="Z" v="A" />
                                <KeyRow k="X" v="B" />
                                <KeyRow k="A" v="L" />
                                <KeyRow k="S" v="R" />
                                <KeyRow k="Enter" v="START" />
                                <KeyRow k="Shift" v="SELECT" />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/* -------------------- UI components -------------------- */

function KeyRow({ k, v }: { k: string; v: string }) {
    return (
        <div className="flex items-center justify-between rounded-xl border px-3 py-2">
            <span className="text-zinc-600">{k}</span>
            <span className="font-medium">{v}</span>
        </div>
    );
}

function TouchButton({
    label,
    onPress,
    onRelease,
    className = "",
}: {
    label: string;
    onPress: () => void;
    onRelease: () => void;
    className?: string;
}) {
    return (
        <button
            className={
                "touch-none select-none rounded-2xl border bg-white/90 px-3 py-3 text-center text-sm font-semibold shadow-sm active:scale-[0.98] " +
                className
            }
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onPress();
            }}
            onPointerUp={() => onRelease()}
            onPointerCancel={() => onRelease()}
            onPointerLeave={() => onRelease()}
        >
            {label}
        </button>
    );
}

/** Mobile overlay: D-pad */
function DPad({
    onPress,
    onRelease,
}: {
    onPress: (b: GbaButton) => void;
    onRelease: (b: GbaButton) => void;
}) {
    return (
        <div className="rounded-3xl border bg-white/70 p-3 backdrop-blur">
            <div className="grid grid-cols-3 gap-2">
                <div />
                <TouchButton label="↑" onPress={() => onPress("UP")} onRelease={() => onRelease("UP")} />
                <div />
                <TouchButton label="←" onPress={() => onPress("LEFT")} onRelease={() => onRelease("LEFT")} />
                <TouchButton label="↓" onPress={() => onPress("DOWN")} onRelease={() => onRelease("DOWN")} />
                <TouchButton label="→" onPress={() => onPress("RIGHT")} onRelease={() => onRelease("RIGHT")} />
            </div>
        </div>
    );
}

/** Mobile overlay: A/B + L/R */
function ABCluster({
    onPress,
    onRelease,
}: {
    onPress: (b: GbaButton) => void;
    onRelease: (b: GbaButton) => void;
}) {
    return (
        <div className="rounded-3xl border bg-white/70 p-3 backdrop-blur">
            <div className="grid grid-cols-2 gap-2">
                <TouchButton label="A" onPress={() => onPress("A")} onRelease={() => onRelease("A")} />
                <TouchButton label="B" onPress={() => onPress("B")} onRelease={() => onRelease("B")} />
                <TouchButton label="L" onPress={() => onPress("L")} onRelease={() => onRelease("L")} />
                <TouchButton label="R" onPress={() => onPress("R")} onRelease={() => onRelease("R")} />
            </div>
        </div>
    );
}

/** Mobile overlay: Start/Select */
function StartSelect({
    onPress,
    onRelease,
}: {
    onPress: (b: GbaButton) => void;
    onRelease: (b: GbaButton) => void;
}) {
    return (
        <div className="flex gap-2">
            <TouchButton
                label="SELECT"
                className="px-4 py-3 text-xs"
                onPress={() => onPress("SELECT")}
                onRelease={() => onRelease("SELECT")}
            />
            <TouchButton
                label="START"
                className="px-4 py-3 text-xs"
                onPress={() => onPress("START")}
                onRelease={() => onRelease("START")}
            />
        </div>
    );
}