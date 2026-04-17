/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import ThemeToggle from "@/components/ThemeToggle";
import { ConfirmDialog } from "@/components/ds/ConfirmDialog";
import { DsRomLibrary } from "@/components/ds/DsRomLibrary";
import Link from "next/link";

import {
    getDsRomBytes,
    touchDsLastPlayed,
    upsertDsRomEntry,
    putDsRomBytes,
} from "@/lib/storage/dsRomStore";
import { hashRom } from "@/lib/hashRom";

function buildEmulatorHTML(romUrl: string, gameName: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body, html { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#000; }
  #game { width:100%; height:100%; }
</style>
</head>
<body>
<div id="game"></div>
<script>
  EJS_player = '#game';
  EJS_core = 'desmume2015';
  EJS_gameUrl = '${romUrl}';
  EJS_gameName = '${gameName.replace(/'/g, "\\'")}';
  EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
  EJS_startOnLoaded = true;
  EJS_color = '#6366f1';
  EJS_backgroundColor = '#000';
  EJS_Buttons = { cacheManager: false };
<\/script>
<script src="https://cdn.emulatorjs.org/stable/data/loader.js"><\/script>
</body>
</html>`;
}

type Tab = "emulator" | "library";

export default function DsPlayer() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const [tab, setTab] = useState<Tab>("emulator");
    const [romName, setRomName] = useState("-");
    const [romHashState, setRomHashState] = useState("");
    const [iframeSrc, setIframeSrc] = useState<string | null>(null);
    const [message, setMessage] = useState("Upload a .nds ROM to begin. Emulation powered by EmulatorJS (DeSmuME).");
    const [showEjectConfirm, setShowEjectConfirm] = useState(false);
    const [menuHidden, setMenuHidden] = useState(false);

    const status = iframeSrc ? "running" : "idle";

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

    function launchRom(romBytes: Uint8Array, name: string) {
        // Revoke previous blob URLs
        if (iframeSrc) URL.revokeObjectURL(iframeSrc);

        const ab = new ArrayBuffer(romBytes.byteLength);
        new Uint8Array(ab).set(romBytes);
        const romBlob = new Blob([ab], { type: "application/octet-stream" });
        const romUrl = URL.createObjectURL(romBlob);
        const gameName = name.replace(/\.[^/.]+$/, "");

        const html = buildEmulatorHTML(romUrl, gameName);
        const htmlBlob = new Blob([html], { type: "text/html" });
        const htmlUrl = URL.createObjectURL(htmlBlob);

        setIframeSrc(htmlUrl);
        setMessage(`Playing: ${name} (${(romBytes.length / 1024 / 1024).toFixed(1)} MB)`);
    }

    async function onUpload(file: File | null) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".nds")) {
            setMessage("Please upload a .nds file.");
            return;
        }

        const buf = await file.arrayBuffer();
        const romBytes = new Uint8Array(buf);
        const romHash = await hashRom(romBytes);

        await putDsRomBytes(romHash, romBytes);
        upsertDsRomEntry({
            romHash,
            name: file.name,
            size: romBytes.length,
            addedAt: Date.now(),
            lastPlayedAt: Date.now(),
        });

        setRomName(file.name);
        setRomHashState(romHash);
        launchRom(romBytes, file.name);
    }

    const loadRomFromLibrary = useCallback(
        async (romHash: string, name: string) => {
            const bytes = await getDsRomBytes(romHash);
            if (!bytes) { setMessage("ROM not found in library."); return; }

            setRomName(name);
            setRomHashState(romHash);
            touchDsLastPlayed(romHash);
            setTab("emulator");
            launchRom(bytes, name);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [iframeSrc],
    );

    function onEject() {
        if (iframeSrc) URL.revokeObjectURL(iframeSrc);
        setIframeSrc(null);
        setRomName("-");
        setRomHashState("");
        setMessage("ROM ejected. Upload or pick a ROM to play.");
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    function onFullscreen() {
        iframeRef.current?.requestFullscreen?.();
    }

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
                    <div className="text-2xl font-bold tracking-tight">DS Emulator</div>
                    <div className="text-sm text-(--muted)">Upload .nds → Play in browser (EmulatorJS + DeSmuME)</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link href="/" className="rounded-full border px-3 py-1 bg-(--panel) border-(--border) text-(--text) hover:-translate-y-px transition">← Home</Link>
                    <ThemeToggle />
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
                            status === "running" ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" : "bg-(--muted)/40",
                        ].join(" ")} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setShowEjectConfirm(true)} className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50 hover:text-red-500 transition" disabled={status === "idle"} type="button">Eject</button>
                        <button onClick={onFullscreen} className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50" disabled={status === "idle"} type="button">Fullscreen</button>
                    </div>
                </div>

                {/* Emulator display */}
                <div className="mt-4 mx-auto max-w-2xl">
                    <div
                        className="relative w-full overflow-hidden rounded-2xl bg-black"
                        style={{
                            aspectRatio: "3 / 4",
                            boxShadow: `0 0 0 1px rgba(255,255,255,.06), 0 0 24px var(--screen-glow)`,
                        }}
                    >
                        {iframeSrc ? (
                            <iframe
                                ref={iframeRef}
                                src={iframeSrc}
                                title={`DS Emulator - ${romName}`}
                                allow="autoplay; gamepad"
                                className="h-full w-full border-none"
                                style={{ display: "block", background: "#000", borderRadius: "16px" }}
                            />
                        ) : (
                            <div className="absolute inset-0 grid place-items-center text-center">
                                <div>
                                    <div className="text-4xl mb-3">🎮</div>
                                    <div className="text-sm text-white/50">Upload a .nds ROM to start playing</div>
                                    <div className="mt-1 text-xs text-white/30">EmulatorJS handles controls, audio, and save states</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom row */}
                <div className={[
                    "mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                    menuHidden ? "hidden" : "",
                ].join(" ")}>
                    <div className="text-sm text-(--muted)">{message}</div>
                    <label className="inline-flex items-center gap-2">
                        <input ref={fileInputRef} type="file" accept=".nds" className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-(--panel-2) file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-(--panel-3)" onChange={(e) => { onUpload(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                    </label>
                </div>

                {/* Info box */}
                <div className={[
                    "mt-4 rounded-2xl bg-(--panel) border border-(--border) p-4 text-sm text-(--muted)",
                    menuHidden ? "hidden" : "",
                ].join(" ")}>
                    <div className="font-medium text-(--text) mb-1">Controls</div>
                    EmulatorJS provides built-in controls: keyboard, gamepad, and on-screen touch buttons.
                    Use the emulator&apos;s own toolbar (inside the player) for save states, settings, and fullscreen.
                </div>
            </div>

            {tab === "library" && <DsRomLibrary onPlay={loadRomFromLibrary} />}

            <ConfirmDialog open={showEjectConfirm} title="Eject ROM" message={`Remove "${romName}" from the emulator? Your save states in the library are kept.`} confirmLabel="Eject" danger onConfirm={() => { setShowEjectConfirm(false); onEject(); }} onCancel={() => setShowEjectConfirm(false)} />
        </div>
    );
}
