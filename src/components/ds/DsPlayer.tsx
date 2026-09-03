"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import ThemeToggle from "@/components/ThemeToggle";
import { ConfirmDialog } from "@/components/ds/ConfirmDialog";
import { DsRomLibrary } from "@/components/ds/DsRomLibrary";
import Link from "next/link";

import {
    getDsRomBytes,
    touchDsLastPlayed,
} from "@/lib/storage/dsRomStore";
import { shouldAutoEnterPlayMode } from "@/lib/shouldAutoEnterPlayMode";

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

function subscribeToOnlineStatus(onStoreChange: () => void) {
    window.addEventListener("online", onStoreChange);
    window.addEventListener("offline", onStoreChange);

    return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
    };
}

function getOnlineStatus() {
    return navigator.onLine;
}

function getServerOnlineStatus() {
    return true;
}

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
    const [message, setMessage] = useState(
        "Open Library to add or choose a .nds ROM. Emulation powered by EmulatorJS (DeSmuME).",
    );
    const [showEjectConfirm, setShowEjectConfirm] = useState(false);
    const [showRestartConfirm, setShowRestartConfirm] = useState(false);
    const [menuHidden, setMenuHidden] = useState(false);
    const [emulatorState, setEmulatorState] = useState<EmulatorState>("idle");
    const isOnline = useSyncExternalStore(
        subscribeToOnlineStatus,
        getOnlineStatus,
        getServerOnlineStatus,
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
                setMenuHidden((hidden) => {
                    if (!hidden) setTab("emulator");
                    return !hidden;
                });
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    useEffect(() => {
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

        window.addEventListener("message", handleFrameMessage);

        return () => {
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

    const loadRomFromLibrary = useCallback(
        async (romHash: string, name: string) => {
            const bytes = await getDsRomBytes(romHash);
            if (!bytes) { setMessage("ROM not found in library."); return; }

            setRomName(name);
            setRomHashState(romHash);
            touchDsLastPlayed(romHash);
            setTab("emulator");
            if (shouldAutoEnterPlayMode()) setMenuHidden(true);
            launchRom(bytes, name);
        },
        [launchRom],
    );

    async function reloadCurrentRom() {
        if (!romHashState || romName === "-") {
            setMessage("Load a ROM before restarting the emulator.");
            return;
        }
        if (!isOnline) {
            setMessage("Reconnect before retrying the DS emulator.");
            return;
        }

        setEmulatorState("loading");
        setMessage(`Preparing ${romName}...`);

        try {
            const bytes = await getDsRomBytes(romHashState);
            if (!bytes) throw new Error("The ROM is no longer available in the library.");

            touchDsLastPlayed(romHashState);
            launchRom(bytes, romName);
        } catch (error) {
            setEmulatorState("error");
            setMessage(
                `Unable to restart DS emulator: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    function onRetryOrRestart() {
        if (status === "running") {
            setShowRestartConfirm(true);
            return;
        }
        void reloadCurrentRom();
    }

    function onEject() {
        revokeActiveUrls();
        if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
        setIframeSrc(null);
        setRomName("-");
        setRomHashState("");
        activeFrameIdRef.current = "";
        gameStartedRef.current = false;
        setEmulatorState("idle");
        setMessage("ROM ejected. Open Library to choose another ROM.");
    }

    function onFullscreen() {
        iframeRef.current?.requestFullscreen?.();
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
                                DS
                            </Link>
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-(--accent)">
                                    EmulatorJS core
                                </div>
                                <h1 className="truncate text-lg font-black tracking-tight sm:text-xl">
                                    Nintendo DS
                                </h1>
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            <span className={[
                                "hidden rounded-xl border bg-(--panel) px-3 py-2 text-xs font-bold md:block",
                                isOnline
                                    ? "border-(--border) text-(--muted)"
                                    : "border-(--warning) text-(--warning)",
                            ].join(" ")}>
                                {isOnline ? "Online" : "Offline"}
                            </span>
                            <ThemeToggle />
                        </div>
                    </div>
                </header>
            )}

            <main className={[
                "mx-auto w-full",
                menuHidden
                    ? "flex min-h-screen max-w-7xl items-center justify-center px-4 py-4 sm:px-6 lg:px-8"
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
                        <>
                            <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className={[
                                        "h-2.5 w-2.5 shrink-0 rounded-full",
                                        status === "error"
                                            ? "bg-(--danger)"
                                            : status === "loading"
                                                ? "bg-(--warning)"
                                                : status === "running"
                                                    ? "bg-(--success)"
                                                    : "bg-(--muted)",
                                    ].join(" ")} />
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-bold">
                                            {romName !== "-" ? romName : "No ROM loaded"}
                                        </div>
                                        <div className="text-[11px] text-(--muted)">
                                            {status === "loading"
                                                ? "Core loading"
                                                : status === "error"
                                                    ? "Core unavailable"
                                                    : status === "running"
                                                        ? "Running"
                                                        : "Ready"}
                                            {romHashState ? ` · #${romHashState.slice(0, 8)}` : ""}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={onRetryOrRestart}
                                        disabled={!romHashState || !isOnline || status === "loading"}
                                        className="rounded-xl border border-(--border) px-3 py-2 text-xs font-bold text-(--muted) transition hover:border-(--accent-border) hover:text-(--text) disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {status === "error" ? "Retry" : "Restart"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowEjectConfirm(true)}
                                        disabled={!iframeSrc}
                                        className="rounded-xl border border-(--border) px-3 py-2 text-xs font-bold text-(--muted) transition hover:border-(--danger) hover:text-(--danger) disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Eject
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onFullscreen}
                                        disabled={!iframeSrc || status === "error"}
                                        className="rounded-xl bg-(--accent) px-4 py-2 text-xs font-bold text-(--accent-text) transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Fullscreen
                                    </button>
                                </div>
                            </div>

                            {!isOnline && (
                                <div className="mt-3 rounded-xl border border-(--warning) bg-(--panel) px-4 py-3 text-xs text-(--warning)">
                                    DS requires internet access to load EmulatorJS.
                                </div>
                            )}
                        </>
                    )}

                    <div
                        className={[
                            "mx-auto w-full",
                            menuHidden ? "" : "mt-4 max-w-2xl",
                        ].join(" ")}
                        style={menuHidden ? { width: "min(100%, calc((100vh - 2rem) * 0.75))" } : undefined}
                    >
                        <div
                            className="relative w-full overflow-hidden rounded-2xl border border-(--border) bg-(--screen)"
                            style={{
                                aspectRatio: "3 / 4",
                                boxShadow: "0 0 24px var(--screen-glow)",
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
                                    className="h-full w-full border-none bg-(--screen)"
                                    onError={() => {
                                        if (loadTimeoutRef.current) window.clearTimeout(loadTimeoutRef.current);
                                        setEmulatorState("error");
                                        setMessage("Failed to load the DS emulator frame. Check your internet connection and try again.");
                                    }}
                                />
                            ) : (
                                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                                    <div>
                                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-(--border) font-mono text-sm font-black text-(--muted)">
                                            DS
                                        </div>
                                        <div className="mt-4 text-sm font-bold text-white">
                                            No ROM loaded
                                        </div>
                                        <div className="mt-1 text-xs text-white/50">
                                            Open Library to add or choose a game
                                        </div>
                                    </div>
                                </div>
                            )}

                            {status === "loading" && (
                                <div className="absolute inset-0 grid place-items-center bg-black/80 px-6 text-center text-white">
                                    <div>
                                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                        <div className="mt-4 text-sm font-bold">Loading DS emulator...</div>
                                        <div className="mt-1 max-w-md text-xs text-white/50">{message}</div>
                                    </div>
                                </div>
                            )}

                            {status === "error" && (
                                <div className="absolute inset-0 grid place-items-center bg-black/85 px-6 text-center text-white">
                                    <div>
                                        <div className="text-sm font-bold text-(--danger)">Unable to start DS emulator</div>
                                        <div className="mt-2 max-w-md text-xs text-white/55">{message}</div>
                                        <button
                                            type="button"
                                            onClick={() => void reloadCurrentRom()}
                                            disabled={!isOnline}
                                            className="mt-4 rounded-xl bg-(--accent) px-4 py-2 text-xs font-bold text-(--accent-text) transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {!menuHidden && (
                        <div
                            className="mt-4 text-xs leading-relaxed text-(--muted)"
                            role="status"
                        >
                            {message}
                        </div>
                    )}
                </div>

                {!menuHidden && tab === "library" && <DsRomLibrary onPlay={loadRomFromLibrary} />}
            </main>

            <ConfirmDialog
                open={showRestartConfirm}
                title="Restart DS game"
                message={`Restart "${romName}" from the beginning? The current DS session state may be lost.`}
                confirmLabel="Restart"
                onConfirm={() => {
                    setShowRestartConfirm(false);
                    void reloadCurrentRom();
                }}
                onCancel={() => setShowRestartConfirm(false)}
            />

            <ConfirmDialog
                open={showEjectConfirm}
                title="Eject ROM"
                message={`Remove "${romName}" from the emulator? The ROM remains in your library, but the current DS session state may be lost.`}
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
