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

const DS_FRAME_READY = "web-emulator:ds-frame-ready";
const DS_LOAD_ROM = "web-emulator:load-ds-rom";
const DS_EMULATOR_READY = "web-emulator:ds-emulator-ready";
const DS_GAME_STARTED = "web-emulator:ds-game-started";
const DS_FRAME_ERROR = "web-emulator:ds-frame-error";
const EMULATORJS_VERSION = "4.2.3";
const EMULATORJS_DATA_URL = `https://cdn.emulatorjs.org/${EMULATORJS_VERSION}/data/`;

type PendingRom = {
    bytes: ArrayBuffer;
    gameName: string;
};

function createCspNonce(): string {
    const bytes = new Uint8Array(16);

    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    // Compatibility fallback for non-secure legacy contexts without Web Crypto.
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

function buildEmulatorHTML(nonce: string, frameId: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; object-src 'none'; form-action 'none'; script-src 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.emulatorjs.org; connect-src blob: data: https://cdn.emulatorjs.org; img-src blob: data: https://cdn.emulatorjs.org; media-src blob: data:; style-src 'unsafe-inline' https://cdn.emulatorjs.org; font-src data: https://cdn.emulatorjs.org; worker-src blob:">
<style>
  body, html { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#000; }
  #game { width:100%; height:100%; }
</style>
</head>
<body>
<div id="game"></div>
<script nonce="${nonce}">
  (function () {
    var parentWindow = window.parent;
    var frameId = "${frameId}";
    var activeRomUrl = null;
    var emulatorReadySent = false;
    var gameStartedSent = false;

    function notify(type, message) {
      parentWindow.postMessage(
        { type: type, message: message || "", frameId: frameId },
        "*"
      );
    }

    // An opaque sandbox origin throws as soon as EmulatorJS reads
    // window.localStorage, before it checks EJS_disableLocalStorage.
    // This in-memory shim makes that getter safe; the disable flags below
    // still prevent EmulatorJS from treating it as persistent storage.
    function installSandboxStorageShim() {
      try {
        void window.localStorage;
        return true;
      } catch {
        var values = Object.create(null);
        var memoryStorage = {
          get length() {
            return Object.keys(values).length;
          },
          key: function (index) {
            return Object.keys(values)[index] || null;
          },
          getItem: function (key) {
            key = String(key);
            return Object.prototype.hasOwnProperty.call(values, key)
              ? values[key]
              : null;
          },
          setItem: function (key, value) {
            values[String(key)] = String(value);
          },
          removeItem: function (key) {
            delete values[String(key)];
          },
          clear: function () {
            values = Object.create(null);
          }
        };

        try {
          Object.defineProperty(window, "localStorage", {
            configurable: true,
            value: memoryStorage
          });
          return true;
        } catch {
          notify(
            "${DS_FRAME_ERROR}",
            "This browser does not allow isolated DS storage access."
          );
          return false;
        }
      }
    }

    if (!installSandboxStorageShim()) return;

    window.addEventListener("error", function (event) {
      if (gameStartedSent) {
        console.warn("[DS emulator] Runtime error after game start:", event.error || event.message);
        return;
      }
      notify("${DS_FRAME_ERROR}", event.message || "DS emulator runtime error.");
    });

    window.addEventListener("unhandledrejection", function (event) {
      var reason = event.reason;
      var reasonName = reason && reason.name ? String(reason.name) : "";
      var reasonMessage =
        reason && reason.message ? String(reason.message) : String(reason || "");

      if (
        reasonName === "NotAllowedError" &&
        /wake.?lock/i.test(reasonMessage)
      ) {
        event.preventDefault();
        return;
      }

      console.warn("[DS emulator] Unhandled promise rejection:", reason);
    });

    window.addEventListener("message", function (event) {
      if (event.source !== parentWindow) return;

      var payload = event.data;
      if (!payload || payload.type !== "${DS_LOAD_ROM}") return;
      if (payload.frameId !== frameId) return;
      if (!(payload.romBytes instanceof ArrayBuffer)) {
        notify("${DS_FRAME_ERROR}", "Invalid ROM data.");
        return;
      }

      if (activeRomUrl) URL.revokeObjectURL(activeRomUrl);
      activeRomUrl = URL.createObjectURL(
        new Blob([payload.romBytes], { type: "application/octet-stream" })
      );

      window.EJS_player = "#game";
      window.EJS_core = "desmume2015";
      window.EJS_gameUrl = activeRomUrl;
      window.EJS_gameName =
        typeof payload.gameName === "string"
          ? payload.gameName.slice(0, 256)
          : "game";
      window.EJS_pathtodata = "${EMULATORJS_DATA_URL}";
      window.EJS_startOnLoaded = true;
      window.EJS_color = "#6366f1";
      window.EJS_backgroundColor = "#000";
      window.EJS_Buttons = { cacheManager: false };
      window.EJS_disableDatabases = true;
      window.EJS_disableLocalStorage = true;
      window.EJS_ready = function () {
        if (emulatorReadySent) return;
        emulatorReadySent = true;
        notify("${DS_EMULATOR_READY}");
      };
      window.EJS_onGameStart = function () {
        if (gameStartedSent) return;
        gameStartedSent = true;
        notify("${DS_GAME_STARTED}");
      };

      var loader = document.createElement("script");
      loader.src = "${EMULATORJS_DATA_URL}loader.js";
      loader.onload = function () {
        var checks = 0;
        var monitor = window.setInterval(function () {
          checks += 1;
          var emulator = window.EJS_emulator;

          if (emulator && !emulatorReadySent) {
            emulatorReadySent = true;
            notify("${DS_EMULATOR_READY}");
          }

          if (emulator && emulator.started && !gameStartedSent) {
            gameStartedSent = true;
            notify("${DS_GAME_STARTED}");
            window.clearInterval(monitor);
            return;
          }

          if (checks >= 1200) {
            window.clearInterval(monitor);
          }
        }, 50);
      };
      loader.onerror = function () {
        notify("${DS_FRAME_ERROR}", "Failed to download EmulatorJS.");
      };
      document.head.appendChild(loader);
    }, { once: true });

    window.addEventListener("pagehide", function () {
      if (activeRomUrl) URL.revokeObjectURL(activeRomUrl);
    });

    notify("${DS_FRAME_READY}");
  })();
<\/script>
</body>
</html>`;
}

type Tab = "emulator" | "library";
type EmulatorState = "idle" | "loading" | "running" | "error";

export default function DsPlayer() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const htmlUrlRef = useRef<string | null>(null);
    const pendingRomRef = useRef<PendingRom | null>(null);
    const activeRomNameRef = useRef("-");
    const activeFrameIdRef = useRef("");
    const gameStartedRef = useRef(false);
    const loadTimeoutRef = useRef<number | null>(null);

    const [tab, setTab] = useState<Tab>("emulator");
    const [romName, setRomName] = useState("-");
    const [romHashState, setRomHashState] = useState("");
    const [iframeSrc, setIframeSrc] = useState<string | null>(null);
    const [message, setMessage] = useState("Upload a .nds ROM to begin. Emulation powered by EmulatorJS (DeSmuME).");
    const [showEjectConfirm, setShowEjectConfirm] = useState(false);
    const [menuHidden, setMenuHidden] = useState(false);
    const [emulatorState, setEmulatorState] = useState<EmulatorState>("idle");
    const [isOnline, setIsOnline] = useState(
        () => typeof navigator === "undefined" || navigator.onLine,
    );

    const status = emulatorState;

    const revokeActiveUrls = useCallback(() => {
        if (htmlUrlRef.current) URL.revokeObjectURL(htmlUrlRef.current);
        htmlUrlRef.current = null;
        pendingRomRef.current = null;
    }, []);

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

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        const handleFrameMessage = (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return;

            const payload = event.data as {
                type?: unknown;
                message?: unknown;
                frameId?: unknown;
            } | null;
            if (
                !payload ||
                typeof payload.type !== "string" ||
                payload.frameId !== activeFrameIdRef.current
            ) return;

            if (payload.type === DS_FRAME_READY) {
                const pending = pendingRomRef.current;
                if (!pending) return;

                iframeRef.current.contentWindow?.postMessage(
                    {
                        type: DS_LOAD_ROM,
                        romBytes: pending.bytes,
                        gameName: pending.gameName,
                        frameId: activeFrameIdRef.current,
                    },
                    "*",
                    [pending.bytes],
                );
                pendingRomRef.current = null;
                return;
            }

            if (payload.type === DS_EMULATOR_READY) {
                setMessage(`EmulatorJS ready. Starting ${activeRomNameRef.current}...`);
                return;
            }

            if (payload.type === DS_GAME_STARTED) {
                if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = null;
                gameStartedRef.current = true;
                setEmulatorState("running");
                setMessage(`Playing: ${activeRomNameRef.current}.`);
                return;
            }

            if (payload.type === DS_FRAME_ERROR) {
                if (gameStartedRef.current) {
                    console.warn("[DS emulator] Ignored error after game start:", payload.message);
                    return;
                }
                if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = null;
                setEmulatorState("error");
                setMessage(
                    typeof payload.message === "string" && payload.message
                        ? payload.message
                        : "Failed to start the DS emulator.",
                );
            }
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        window.addEventListener("message", handleFrameMessage);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("message", handleFrameMessage);
            if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
            revokeActiveUrls();
        };
    }, [revokeActiveUrls]);

    const launchRom = useCallback((romBytes: Uint8Array, name: string) => {
        revokeActiveUrls();
        if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);

        const ab = new ArrayBuffer(romBytes.byteLength);
        new Uint8Array(ab).set(romBytes);
        const gameName = name.replace(/\.[^/.]+$/, "");

        const nonce = createCspNonce();
        const frameId = createCspNonce();
        const html = buildEmulatorHTML(nonce, frameId);
        const htmlBlob = new Blob([html], { type: "text/html" });
        const htmlUrl = URL.createObjectURL(htmlBlob);

        pendingRomRef.current = { bytes: ab, gameName };
        activeRomNameRef.current = name;
        activeFrameIdRef.current = frameId;
        gameStartedRef.current = false;
        htmlUrlRef.current = htmlUrl;
        setEmulatorState("loading");
        setIframeSrc(htmlUrl);
        setMessage(`Loading ${name} (${(romBytes.length / 1024 / 1024).toFixed(1)} MB). DS emulation loads EmulatorJS assets from the internet.`);
        loadTimeoutRef.current = window.setTimeout(() => {
            loadTimeoutRef.current = null;
            setEmulatorState((current) => {
                if (current !== "loading") return current;
                setMessage("DS emulator timed out while loading its core. Check the connection and try again.");
                return "error";
            });
        }, 60_000);
    }, [revokeActiveUrls]);

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
        [launchRom],
    );

    function onEject() {
        revokeActiveUrls();
        if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
        setIframeSrc(null);
        setRomName("-");
        setRomHashState("");
        activeFrameIdRef.current = "";
        gameStartedRef.current = false;
        setEmulatorState("idle");
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
                            status === "running" ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" : "",
                            status === "loading" ? "bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.5)]" : "",
                            status === "error" ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]" : "",
                            status === "idle" ? "bg-(--muted)/40" : "",
                        ].join(" ")} />
                        {romHashState && <div className="text-xs text-(--muted)">#{romHashState.slice(0, 8)}</div>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setShowEjectConfirm(true)} className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50 hover:text-red-500 transition" disabled={!iframeSrc} type="button">Eject</button>
                        <button onClick={onFullscreen} className="rounded-xl border border-(--border) px-4 py-2 text-xs disabled:opacity-50" disabled={!iframeSrc || status === "error"} type="button">Fullscreen</button>
                    </div>
                </div>

                {!isOnline && (
                    <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
                        DS emulation needs internet access to load EmulatorJS. Reconnect before launching a ROM.
                    </div>
                )}

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
                                sandbox="allow-scripts allow-pointer-lock allow-downloads"
                                allow="autoplay; gamepad; fullscreen; screen-wake-lock *"
                                allowFullScreen
                                referrerPolicy="no-referrer"
                                className="h-full w-full border-none"
                                style={{ display: "block", background: "#000", borderRadius: "16px" }}
                                onError={() => {
                                    if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
                                    setEmulatorState("error");
                                    setMessage("Failed to load the DS emulator frame. Check your internet connection and try again.");
                                }}
                            />
                        ) : (
                            <div className="absolute inset-0 grid place-items-center text-center">
                                <div>
                                    <div className="text-4xl mb-3">🎮</div>
                                    <div className="text-sm text-white/50">Upload a .nds ROM to start playing</div>
                                    <div className="mt-1 text-xs text-white/30">EmulatorJS handles controls and audio</div>
                                </div>
                            </div>
                        )}
                        {status === "loading" && (
                            <div className="absolute inset-0 grid place-items-center bg-black/75 text-center text-white">
                                <div>
                                    <div className="text-sm font-medium">Loading DS emulator...</div>
                                    <div className="mt-1 max-w-md px-4 text-xs text-white/50">{message}</div>
                                </div>
                            </div>
                        )}
                        {status === "error" && (
                            <div className="absolute inset-0 grid place-items-center bg-black/80 text-center text-white">
                                <div>
                                    <div className="text-sm font-medium text-red-200">Unable to start DS emulator</div>
                                    <div className="mt-1 max-w-md px-4 text-xs text-white/50">{message}</div>
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
                    Use the emulator&apos;s own toolbar (inside the player) for settings and fullscreen.
                    Persistent DS save states are currently disabled inside the restricted player frame.
                    DS emulation requires internet access because EmulatorJS is loaded from its CDN.
                </div>
            </div>

            {tab === "library" && <DsRomLibrary onPlay={loadRomFromLibrary} />}

            <ConfirmDialog open={showEjectConfirm} title="Eject ROM" message={`Remove "${romName}" from the emulator? The ROM remains in your library, but the current DS session state may be lost.`} confirmLabel="Eject" danger onConfirm={() => { setShowEjectConfirm(false); onEject(); }} onCancel={() => setShowEjectConfirm(false)} />
        </div>
    );
}
