"use client";

import Link from "next/link";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";

import { VirtualJoystick } from "@/components/emulator/VirtualJoystick";
import { useModalDialog } from "@/lib/hooks/useModalDialog";
import {
    clampControlOpacity,
    clampControlPosition,
    clampControlScale,
    getDefaultPhoneControlPreferences,
    PHONE_SYSTEM_CONTROLS,
    readPhoneControlPreferences,
    writePhoneControlPreferences,
    type PhoneControlId,
    type PhoneControlOrientation,
    type PhoneControlPoint,
    type PhoneControlPreferences,
} from "@/lib/phone-controller/control-layout";
import type {
    PhoneControlMessage,
    PhoneControllerSystem,
    SerializedSessionDescription,
} from "@/lib/phone-controller/types";
import {
    serializeDescription,
    waitForIceGathering,
} from "@/lib/phone-controller/webrtc";

type ConnectionStatus =
    | "idle"
    | "connecting"
    | "waiting"
    | "connected"
    | "error";

function subscribeToOrientation(onStoreChange: () => void) {
    window.addEventListener("resize", onStoreChange);
    window.addEventListener("orientationchange", onStoreChange);
    return () => {
        window.removeEventListener("resize", onStoreChange);
        window.removeEventListener("orientationchange", onStoreChange);
    };
}

function getOrientation(): PhoneControlOrientation {
    return window.innerWidth >= window.innerHeight
        ? "landscape"
        : "portrait";
}

function getServerOrientation(): PhoneControlOrientation {
    return "landscape";
}

function ConnectionDialog({
    open,
    code,
    status,
    system,
    message,
    onCodeChange,
    onConnect,
    onDisconnect,
    onClose,
}: {
    open: boolean;
    code: string;
    status: ConnectionStatus;
    system: PhoneControllerSystem | null;
    message: string;
    onCodeChange: (code: string) => void;
    onConnect: () => void;
    onDisconnect: () => void;
    onClose: () => void;
}) {
    const dialogRef = useModalDialog<HTMLElement>(open, onClose);
    if (!open) return null;

    const connected = status === "connected" && system !== null;
    const busy = status === "connecting" || status === "waiting";

    return (
        <div
            className="fixed inset-0 z-60 grid place-items-center p-4"
            role="presentation"
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close phone connection"
            />
            <section
                ref={dialogRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="phone-connection-title"
                className="relative z-10 w-full max-w-sm rounded-2xl border border-(--border) bg-(--panel) p-5 shadow-(--shadow-2)"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-(--accent)">
                            Phone Controller
                        </div>
                        <h2
                            id="phone-connection-title"
                            className="mt-1 text-xl font-black"
                        >
                            Phone connection
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-(--border) text-(--muted)"
                        aria-label="Close phone connection"
                    >
                        <span aria-hidden="true">✕</span>
                    </button>
                </div>

                {connected ? (
                    <div className="mt-5 rounded-2xl border border-(--success-border) bg-(--success-soft) p-4 text-center">
                        <span className="mx-auto block h-3 w-3 rounded-full bg-(--success)" />
                        <div className="mt-2 font-black text-(--success)">
                            Connected
                        </div>
                        <div className="mt-1 text-xs uppercase text-(--muted)">
                            {system}
                        </div>
                    </div>
                ) : (
                    <label
                        htmlFor="pairing-code"
                        className="mt-5 block text-[10px] font-black uppercase tracking-[0.16em] text-(--muted)"
                    >
                        Pairing code
                        <input
                            id="pairing-code"
                            value={code}
                            onChange={(event) => onCodeChange(
                                event.target.value.replace(/\D/g, "").slice(0, 6),
                            )}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]*"
                            maxLength={6}
                            disabled={busy}
                            data-autofocus
                            className="mt-2 w-full rounded-xl border border-(--border) bg-(--panel-2) px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.22em]"
                            placeholder="000000"
                        />
                    </label>
                )}

                <p
                    className={[
                        "mt-4 text-sm leading-relaxed",
                        status === "error"
                            ? "text-(--danger)"
                            : "text-(--muted)",
                    ].join(" ")}
                    role="status"
                >
                    {message}
                </p>

                <div className="mt-5 flex justify-end gap-2">
                    {connected ? (
                        <button
                            type="button"
                            onClick={onDisconnect}
                            className="rounded-xl border border-(--danger) px-4 py-2 text-xs font-bold text-(--danger)"
                        >
                            Disconnect
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onConnect}
                            disabled={busy}
                            className="rounded-xl bg-(--accent) px-4 py-2 text-xs font-bold text-(--accent-text) disabled:opacity-40"
                        >
                            {busy ? "Connecting..." : "Connect"}
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
}

function ControllerButton({
    label,
    button,
    onPress,
    onRelease,
    disabled,
    round = false,
    editing = false,
}: {
    label: string;
    button: string;
    onPress: (button: string) => void;
    onRelease: (button: string) => void;
    disabled: boolean;
    round?: boolean;
    editing?: boolean;
}) {
    const activePointerRef = useRef<number | null>(null);

    const finishPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (activePointerRef.current !== event.pointerId) return;
        activePointerRef.current = null;
        event.preventDefault();
        onRelease(button);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    return (
        <button
            type="button"
            disabled={disabled}
            aria-label={label}
            className={[
                "touch-none select-none border border-(--border) bg-(--panel-2) font-black text-(--text) shadow-(--shadow) transition active:scale-95 active:border-(--accent-border) active:bg-(--accent) active:text-(--accent-text)",
                round
                    ? "grid h-[clamp(3.75rem,18vw,7rem)] w-[clamp(3.75rem,18vw,7rem)] place-items-center rounded-full text-xl landscape:h-[clamp(4.5rem,22vmin,7rem)] landscape:w-[clamp(4.5rem,22vmin,7rem)]"
                    : "min-h-10 rounded-xl px-3 text-xs sm:min-h-11 sm:px-4",
                disabled && !editing ? "opacity-40" : "",
            ].join(" ")}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
                if (activePointerRef.current !== null) return;
                event.preventDefault();
                activePointerRef.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                onPress(button);
                navigator.vibrate?.(8);
            }}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
            onLostPointerCapture={(event) => {
                if (activePointerRef.current !== event.pointerId) return;
                activePointerRef.current = null;
                onRelease(button);
            }}
        >
            {label}
        </button>
    );
}

function PositionedControl({
    id,
    point,
    editing,
    scale,
    opacity,
    surfaceRef,
    onMove,
    children,
}: {
    id: PhoneControlId;
    point: PhoneControlPoint;
    editing: boolean;
    scale: number;
    opacity: number;
    surfaceRef: React.RefObject<HTMLDivElement | null>;
    onMove: (id: PhoneControlId, point: PhoneControlPoint) => void;
    children: React.ReactNode;
}) {
    const activePointerRef = useRef<number | null>(null);
    const controlRef = useRef<HTMLDivElement | null>(null);

    const keepInsideSurface = useCallback(
        (nextPoint: PhoneControlPoint) => {
            const rect = surfaceRef.current?.getBoundingClientRect();
            const controlRect = controlRef.current?.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.height <= 0) {
                return clampControlPosition(nextPoint);
            }
            const maximumScale = 1.35;
            const currentScale = Math.max(0.01, scale);
            const marginX = controlRect
                ? Math.min(
                    45,
                    (
                        controlRect.width /
                        currentScale *
                        maximumScale /
                        2 /
                        rect.width
                    ) * 100 + 1,
                )
                : 6;
            const marginY = controlRect
                ? Math.min(
                    45,
                    (
                        controlRect.height /
                        currentScale *
                        maximumScale /
                        2 /
                        rect.height
                    ) * 100 + 1,
                )
                : 8;
            return clampControlPosition(nextPoint, marginX, marginY);
        },
        [scale, surfaceRef],
    );

    const updatePosition = useCallback(
        (clientX: number, clientY: number) => {
            const rect = surfaceRef.current?.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.height <= 0) return;
            onMove(id, keepInsideSurface({
                x: ((clientX - rect.left) / rect.width) * 100,
                y: ((clientY - rect.top) / rect.height) * 100,
            }));
        },
        [id, keepInsideSurface, onMove, surfaceRef],
    );

    const finishPointer = (
        event: React.PointerEvent<HTMLDivElement>,
    ) => {
        if (activePointerRef.current !== event.pointerId) return;
        activePointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    return (
        <div
            ref={controlRef}
            data-control-id={id}
            role={editing ? "group" : undefined}
            aria-label={editing ? `Move ${id} control` : undefined}
            tabIndex={editing ? 0 : -1}
            className={[
                "absolute origin-center touch-none select-none",
                editing
                    ? "z-30 cursor-move rounded-2xl outline-2 outline-offset-4 outline-(--accent-border)"
                    : "",
            ].join(" ")}
            style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                opacity: editing ? 1 : opacity,
                transform: `translate(-50%, -50%) scale(${scale})`,
            }}
            onPointerDown={(event) => {
                if (!editing || activePointerRef.current !== null) return;
                event.preventDefault();
                activePointerRef.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                updatePosition(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
                if (
                    !editing ||
                    activePointerRef.current !== event.pointerId ||
                    !event.currentTarget.hasPointerCapture(event.pointerId)
                ) return;
                event.preventDefault();
                updatePosition(event.clientX, event.clientY);
            }}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
            onLostPointerCapture={(event) => {
                if (activePointerRef.current === event.pointerId) {
                    activePointerRef.current = null;
                }
            }}
            onKeyDown={(event) => {
                if (!editing) return;
                const distance = event.shiftKey ? 5 : 1;
                const delta = {
                    ArrowUp: { x: 0, y: -distance },
                    ArrowDown: { x: 0, y: distance },
                    ArrowLeft: { x: -distance, y: 0 },
                    ArrowRight: { x: distance, y: 0 },
                }[event.key];
                if (!delta) return;
                event.preventDefault();
                onMove(id, keepInsideSurface({
                    x: point.x + delta.x,
                    y: point.y + delta.y,
                }));
            }}
        >
            {editing && (
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded-md bg-(--accent) px-1.5 py-0.5 text-[8px] font-black uppercase text-(--accent-text)">
                    {id}
                </span>
            )}
            <div className={editing ? "pointer-events-none" : ""}>
                {children}
            </div>
        </div>
    );
}

function ControllerSurface({
    system,
    orientation,
    connected,
    editing,
    onFinishEditing,
    onPress,
    onRelease,
}: {
    system: PhoneControllerSystem | null;
    orientation: PhoneControlOrientation;
    connected: boolean;
    editing: boolean;
    onFinishEditing: () => void;
    onPress: (button: string) => void;
    onRelease: (button: string) => void;
}) {
    const surfaceRef = useRef<HTMLDivElement | null>(null);
    const [preferences, setPreferences] = useState<PhoneControlPreferences>(
        () => system
            ? readPhoneControlPreferences(system, orientation)
            : getDefaultPhoneControlPreferences(orientation),
    );
    const controls = system ? PHONE_SYSTEM_CONTROLS[system] : null;
    const buttons = controls?.buttons ?? [];
    const [leftShoulder, rightShoulder] = controls?.shoulders ?? [];
    const faceButtons = controls?.faceButtons ?? ["B", "A"];

    const updatePreferences = useCallback(
        (
            update: (
                current: PhoneControlPreferences,
            ) => PhoneControlPreferences,
        ) => {
            setPreferences((current) => {
                const next = update(current);
                if (system) {
                    writePhoneControlPreferences(system, orientation, next);
                }
                return next;
            });
        },
        [orientation, system],
    );

    const moveControl = useCallback(
        (id: PhoneControlId, point: PhoneControlPoint) => {
            updatePreferences((current) => ({
                ...current,
                positions: {
                    ...current.positions,
                    [id]: point,
                },
            }));
        },
        [updatePreferences],
    );

    const positionControl = (
        id: PhoneControlId,
        child: React.ReactNode,
    ) => (
        <PositionedControl
            key={id}
            id={id}
            point={preferences.positions[id]}
            editing={editing}
            scale={preferences.scale}
            opacity={preferences.opacity}
            surfaceRef={surfaceRef}
            onMove={moveControl}
        >
            {child}
        </PositionedControl>
    );

    return (
        <section
            className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-2xl border border-(--border) bg-(--panel)"
            aria-label="Virtual controller"
        >
            {!editing && (
                <p className="pointer-events-none absolute inset-x-0 top-2 z-20 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-(--warning) landscape:hidden">
                    Rotate your phone for the landscape controller
                </p>
            )}

            {editing && (
                <div className="absolute inset-x-2 top-2 z-40 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-(--accent-border) bg-(--panel-translucent) p-2 shadow-(--shadow) backdrop-blur">
                    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-(--accent)">
                        Editing {system} {orientation}
                    </span>
                    <label className="flex items-center gap-1.5 text-[9px] font-bold text-(--muted)">
                        Size
                        <input
                            type="range"
                            aria-label="Control size"
                            min="70"
                            max="135"
                            value={Math.round(preferences.scale * 100)}
                            onChange={(event) => {
                                const scale = clampControlScale(
                                    Number(event.target.value) / 100,
                                );
                                updatePreferences((current) => ({
                                    ...current,
                                    scale,
                                }));
                            }}
                            className="w-20 accent-(--accent)"
                        />
                    </label>
                    <label className="flex items-center gap-1.5 text-[9px] font-bold text-(--muted)">
                        Opacity
                        <input
                            type="range"
                            aria-label="Control opacity"
                            min="45"
                            max="100"
                            value={Math.round(preferences.opacity * 100)}
                            onChange={(event) => {
                                const opacity = clampControlOpacity(
                                    Number(event.target.value) / 100,
                                );
                                updatePreferences((current) => ({
                                    ...current,
                                    opacity,
                                }));
                            }}
                            className="w-20 accent-(--accent)"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            const defaults =
                                getDefaultPhoneControlPreferences(orientation);
                            setPreferences(defaults);
                            if (system) {
                                writePhoneControlPreferences(
                                    system,
                                    orientation,
                                    defaults,
                                );
                            }
                        }}
                        className="rounded-lg border border-(--border) px-2 py-1 text-[9px] font-bold text-(--muted)"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={onFinishEditing}
                        className="rounded-lg bg-(--accent) px-2 py-1 text-[9px] font-bold text-(--accent-text)"
                    >
                        Lock layout
                    </button>
                </div>
            )}

            <div
                ref={surfaceRef}
                className="absolute inset-0"
                aria-label="Control layout"
            >
                {positionControl(
                    "joystick",
                    <VirtualJoystick
                        key={`${connected}:${editing}`}
                        className={[
                            "w-[clamp(7rem,32vw,12rem)] shadow-(--shadow) landscape:w-[clamp(8rem,44vmin,12rem)]",
                            editing ? "!opacity-100" : "",
                        ].join(" ")}
                        onPress={(direction) => onPress(direction)}
                        onRelease={(direction) => onRelease(direction)}
                        disabled={!connected || editing}
                        haptic
                    />,
                )}

                {leftShoulder && positionControl(
                    leftShoulder,
                    <ControllerButton
                        label={leftShoulder}
                        button={leftShoulder}
                        onPress={onPress}
                        onRelease={onRelease}
                        disabled={!connected || editing}
                        editing={editing}
                    />,
                )}

                {rightShoulder && positionControl(
                    rightShoulder,
                    <ControllerButton
                        label={rightShoulder}
                        button={rightShoulder}
                        onPress={onPress}
                        onRelease={onRelease}
                        disabled={!connected || editing}
                        editing={editing}
                    />,
                )}

                {positionControl(
                    "SELECT",
                    <ControllerButton
                        label="Select"
                        button="SELECT"
                        onPress={onPress}
                        onRelease={onRelease}
                        disabled={!connected || editing}
                        editing={editing}
                    />,
                )}

                {positionControl(
                    "START",
                    <ControllerButton
                        label="Start"
                        button="START"
                        onPress={onPress}
                        onRelease={onRelease}
                        disabled={!connected || editing}
                        editing={editing}
                    />,
                )}

                {faceButtons.map((button) => positionControl(
                    button,
                    <ControllerButton
                        label={button}
                        button={button}
                        onPress={onPress}
                        onRelease={onRelease}
                        disabled={!connected || editing}
                        editing={editing}
                        round
                    />,
                ))}
            </div>

            {system && (
                <div className="sr-only">
                    Available buttons: {buttons.join(", ")}
                </div>
            )}
        </section>
    );
}

export default function PhoneControllerClient({
    initialCode,
}: {
    initialCode: string;
}) {
    const [code, setCode] = useState(initialCode);
    const [status, setStatus] = useState<ConnectionStatus>("idle");
    const [system, setSystem] = useState<PhoneControllerSystem | null>(null);
    const [message, setMessage] = useState(
        initialCode
            ? "Ready to connect to the emulator."
            : "Enter the six-digit code shown on the emulator.",
    );
    const [connectionOpen, setConnectionOpen] = useState(Boolean(initialCode));
    const [editingControls, setEditingControls] = useState(false);
    const orientation = useSyncExternalStore(
        subscribeToOrientation,
        getOrientation,
        getServerOrientation,
    );
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<RTCDataChannel | null>(null);
    const heartbeatTimerRef = useRef<number | null>(null);
    const pressedButtonsRef = useRef(new Set<string>());
    const generationRef = useRef(0);

    const sendMessage = useCallback((payload: PhoneControlMessage) => {
        const channel = channelRef.current;
        if (!channel || channel.readyState !== "open") return;
        channel.send(JSON.stringify(payload));
    }, []);

    const releaseAll = useCallback(() => {
        if (pressedButtonsRef.current.size > 0) {
            sendMessage({ type: "release-all" });
        }
        pressedButtonsRef.current.clear();
    }, [sendMessage]);

    const stopHeartbeat = useCallback(() => {
        if (heartbeatTimerRef.current === null) return;
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
    }, []);

    const startHeartbeat = useCallback(() => {
        stopHeartbeat();
        sendMessage({ type: "heartbeat" });
        heartbeatTimerRef.current = window.setInterval(() => {
            sendMessage({ type: "heartbeat" });
        }, 1_000);
    }, [sendMessage, stopHeartbeat]);

    const disconnect = useCallback((resetState: boolean) => {
        generationRef.current += 1;
        stopHeartbeat();
        releaseAll();
        channelRef.current?.close();
        channelRef.current = null;
        peerRef.current?.close();
        peerRef.current = null;
        if (resetState) {
            setEditingControls(false);
            setStatus("idle");
            setSystem(null);
            setMessage("Enter a pairing code to reconnect.");
        }
    }, [releaseAll, stopHeartbeat]);

    const press = useCallback((button: string) => {
        if (pressedButtonsRef.current.has(button)) return;
        pressedButtonsRef.current.add(button);
        sendMessage({ type: "press", button });
    }, [sendMessage]);

    const release = useCallback((button: string) => {
        if (!pressedButtonsRef.current.has(button)) return;
        pressedButtonsRef.current.delete(button);
        sendMessage({ type: "release", button });
    }, [sendMessage]);

    const connect = useCallback(async () => {
        const normalizedCode = code.replace(/\D/g, "").slice(0, 6);
        setCode(normalizedCode);
        if (normalizedCode.length !== 6) {
            setStatus("error");
            setMessage("Enter a valid six-digit pairing code.");
            return;
        }

        disconnect(false);
        const generation = generationRef.current;
        setStatus("connecting");
        setMessage("Finding the emulator...");

        try {
            if (typeof RTCPeerConnection === "undefined") {
                throw new Error("This browser does not support WebRTC.");
            }

            const sessionResponse = await fetch(
                `/api/controller/sessions/${normalizedCode}`,
                { cache: "no-store" },
            );
            const session = await sessionResponse.json() as {
                system?: PhoneControllerSystem;
                offer?: SerializedSessionDescription;
                error?: string;
            };
            if (!sessionResponse.ok || !session.system || !session.offer) {
                throw new Error(session.error || "Pairing session not found.");
            }
            if (generation !== generationRef.current) return;

            const peer = new RTCPeerConnection();
            peerRef.current = peer;
            setSystem(session.system);

            peer.addEventListener("datachannel", (event) => {
                if (generation !== generationRef.current) return;
                const channel = event.channel;
                channelRef.current = channel;
                channel.addEventListener("open", () => {
                    if (generation !== generationRef.current) return;
                    startHeartbeat();
                    setStatus("connected");
                    setMessage("Connected. Your phone is now the controller.");
                    setConnectionOpen(false);
                });
                channel.addEventListener("close", () => {
                    stopHeartbeat();
                    releaseAll();
                    if (generation !== generationRef.current) return;
                    setStatus("error");
                    setMessage("The emulator disconnected.");
                    setConnectionOpen(true);
                });
            });
            peer.addEventListener("connectionstatechange", () => {
                if (generation !== generationRef.current) return;
                if (peer.connectionState === "disconnected") {
                    releaseAll();
                    setStatus("waiting");
                    setMessage("Connection interrupted. Waiting for the emulator...");
                } else if (
                    peer.connectionState === "connected" &&
                    channelRef.current?.readyState === "open"
                ) {
                    setStatus("connected");
                    setMessage("Connected. Your phone is now the controller.");
                    setConnectionOpen(false);
                } else if (peer.connectionState === "failed") {
                    stopHeartbeat();
                    releaseAll();
                    setEditingControls(false);
                    setStatus("error");
                    setMessage(
                        "Connection lost. Create a new pairing code on the emulator to reconnect.",
                    );
                    setConnectionOpen(true);
                }
            });

            await peer.setRemoteDescription(session.offer);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await waitForIceGathering(peer);

            const answerResponse = await fetch(
                `/api/controller/sessions/${normalizedCode}/answer`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        answer: serializeDescription(peer.localDescription),
                    }),
                },
            );
            const answerResult = await answerResponse.json() as {
                accepted?: boolean;
                error?: string;
            };
            if (!answerResponse.ok || !answerResult.accepted) {
                throw new Error(answerResult.error || "Unable to submit pairing answer.");
            }
            if (generation !== generationRef.current) return;

            setStatus("waiting");
            setMessage("Pairing accepted. Establishing the direct connection...");
        } catch (error) {
            if (generation !== generationRef.current) return;
            peerRef.current?.close();
            peerRef.current = null;
            channelRef.current = null;
            stopHeartbeat();
            setEditingControls(false);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : String(error));
            setConnectionOpen(true);
        }
    }, [
        code,
        disconnect,
        releaseAll,
        startHeartbeat,
        stopHeartbeat,
    ]);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                releaseAll();
            } else if (channelRef.current?.readyState === "open") {
                sendMessage({ type: "heartbeat" });
            }
        };
        const onFocus = () => {
            if (channelRef.current?.readyState === "open") {
                sendMessage({ type: "heartbeat" });
            }
        };
        window.addEventListener("pagehide", releaseAll);
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.removeEventListener("pagehide", releaseAll);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            disconnect(false);
        };
    }, [disconnect, releaseAll, sendMessage]);

    const connected = status === "connected" && system !== null;

    return (
        <main className="h-dvh overflow-hidden bg-(--bg) p-2 text-(--text) sm:p-3">
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
                <header className="flex shrink-0 items-center justify-between gap-4 px-1">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-(--accent)">
                            Web Emulator Lab
                        </div>
                        <h1 className="text-base font-black sm:text-lg">
                            Phone Controller
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setConnectionOpen(true)}
                            className="flex items-center gap-2 rounded-lg border border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted)"
                        >
                            <span
                                className={[
                                    "h-2 w-2 rounded-full",
                                    connected
                                        ? "bg-(--success)"
                                        : status === "error"
                                            ? "bg-(--danger)"
                                            : "bg-(--muted)",
                                ].join(" ")}
                                aria-hidden="true"
                            />
                            {connected
                                ? "Connected"
                                : status === "connecting" || status === "waiting"
                                    ? "Connecting"
                                    : "Connect"}
                        </button>
                        <button
                            type="button"
                            disabled={!system}
                            onClick={() => {
                                if (!editingControls) releaseAll();
                                setEditingControls((current) => !current);
                            }}
                            className="rounded-lg border border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted) disabled:opacity-40"
                            aria-label={
                                editingControls
                                    ? "Lock controller layout"
                                    : "Customize controller layout"
                            }
                        >
                            {editingControls ? "Done" : "Layout"}
                        </button>
                        <Link
                            href="/"
                            className="rounded-lg border border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted)"
                        >
                            Systems
                        </Link>
                    </div>
                </header>

                <ControllerSurface
                    key={`${system ?? "disconnected"}:${orientation}`}
                    system={system}
                    orientation={orientation}
                    connected={connected}
                    editing={editingControls}
                    onFinishEditing={() => setEditingControls(false)}
                    onPress={press}
                    onRelease={release}
                />
            </div>
            <ConnectionDialog
                open={connectionOpen}
                code={code}
                status={status}
                system={system}
                message={message}
                onCodeChange={setCode}
                onConnect={() => void connect()}
                onDisconnect={() => disconnect(true)}
                onClose={() => setConnectionOpen(false)}
            />
        </main>
    );
}
