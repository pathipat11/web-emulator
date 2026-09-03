"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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

const SYSTEM_BUTTONS: Record<PhoneControllerSystem, readonly string[]> = {
    gba: ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "L", "R", "START", "SELECT"],
    nes: ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "START", "SELECT"],
};

function ControllerButton({
    label,
    button,
    onPress,
    onRelease,
    disabled,
    round = false,
}: {
    label: string;
    button: string;
    onPress: (button: string) => void;
    onRelease: (button: string) => void;
    disabled: boolean;
    round?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            aria-label={label}
            className={[
                "touch-none select-none border border-(--border) bg-(--panel-2) font-black text-(--text) shadow-(--shadow) transition active:scale-95 active:border-(--accent-border) active:bg-(--accent) active:text-(--accent-text) disabled:opacity-40",
                round
                    ? "grid h-[clamp(3.75rem,18vw,7rem)] w-[clamp(3.75rem,18vw,7rem)] place-items-center rounded-full text-xl landscape:h-[clamp(4.5rem,22vmin,7rem)] landscape:w-[clamp(4.5rem,22vmin,7rem)]"
                    : "min-h-10 rounded-xl px-3 text-xs sm:min-h-11 sm:px-4",
            ].join(" ")}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                onPress(button);
                navigator.vibrate?.(8);
            }}
            onPointerUp={(event) => {
                event.preventDefault();
                onRelease(button);
            }}
            onPointerCancel={() => onRelease(button)}
            onLostPointerCapture={() => onRelease(button)}
        >
            {label}
        </button>
    );
}

const JOYSTICK_DIRECTIONS = ["UP", "DOWN", "LEFT", "RIGHT"] as const;

function VirtualJoystick({
    onPress,
    onRelease,
    disabled,
}: {
    onPress: (button: string) => void;
    onRelease: (button: string) => void;
    disabled: boolean;
}) {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const activeDirectionsRef = useRef(new Set<string>());

    const releaseDirections = useCallback(() => {
        for (const direction of activeDirectionsRef.current) {
            onRelease(direction);
        }
        activeDirectionsRef.current.clear();
        setPosition({ x: 0, y: 0 });
    }, [onRelease]);

    const updateJoystick = useCallback(
        (
            clientX: number,
            clientY: number,
            element: HTMLDivElement,
        ) => {
            const rect = element.getBoundingClientRect();
            const rawX = clientX - (rect.left + rect.width / 2);
            const rawY = clientY - (rect.top + rect.height / 2);
            const maxDistance = Math.min(rect.width, rect.height) * 0.3;
            const distance = Math.hypot(rawX, rawY);
            const scale = distance > maxDistance ? maxDistance / distance : 1;
            const x = rawX * scale;
            const y = rawY * scale;
            const normalizedX = x / maxDistance;
            const normalizedY = y / maxDistance;
            const deadzone = 0.28;
            const nextDirections = new Set<string>();

            if (normalizedX < -deadzone) nextDirections.add("LEFT");
            if (normalizedX > deadzone) nextDirections.add("RIGHT");
            if (normalizedY < -deadzone) nextDirections.add("UP");
            if (normalizedY > deadzone) nextDirections.add("DOWN");

            for (const direction of activeDirectionsRef.current) {
                if (!nextDirections.has(direction)) onRelease(direction);
            }
            for (const direction of nextDirections) {
                if (!activeDirectionsRef.current.has(direction)) onPress(direction);
            }

            activeDirectionsRef.current = nextDirections;
            setPosition({ x, y });
        },
        [onPress, onRelease],
    );

    return (
        <div
            role="application"
            aria-label="Virtual joystick"
            aria-disabled={disabled}
            className={[
                "relative aspect-square w-[clamp(7rem,32vw,12rem)] touch-none select-none rounded-full border border-(--border) bg-(--panel-2) shadow-(--shadow) transition landscape:w-[clamp(8rem,44vmin,12rem)]",
                disabled ? "opacity-40" : "",
            ].join(" ")}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
                if (disabled) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                updateJoystick(
                    event.clientX,
                    event.clientY,
                    event.currentTarget,
                );
                navigator.vibrate?.(8);
            }}
            onPointerMove={(event) => {
                if (
                    disabled ||
                    !event.currentTarget.hasPointerCapture(event.pointerId)
                ) return;
                event.preventDefault();
                updateJoystick(
                    event.clientX,
                    event.clientY,
                    event.currentTarget,
                );
            }}
            onPointerUp={(event) => {
                event.preventDefault();
                releaseDirections();
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }
            }}
            onPointerCancel={releaseDirections}
            onLostPointerCapture={releaseDirections}
        >
            <div className="absolute inset-[12%] rounded-full border border-(--border) bg-(--panel-3)" />
            {JOYSTICK_DIRECTIONS.map((direction) => (
                <span
                    key={direction}
                    aria-hidden="true"
                    className={[
                        "absolute h-1.5 w-1.5 rounded-full bg-(--muted)",
                        direction === "UP"
                            ? "left-1/2 top-[8%] -translate-x-1/2"
                            : direction === "DOWN"
                                ? "bottom-[8%] left-1/2 -translate-x-1/2"
                                : direction === "LEFT"
                                    ? "left-[8%] top-1/2 -translate-y-1/2"
                                    : "right-[8%] top-1/2 -translate-y-1/2",
                    ].join(" ")}
                />
            ))}
            <div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 grid h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-(--accent-border) bg-(--accent) shadow-(--shadow-2) transition-transform duration-75"
                style={{
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                }}
            >
                <span className="h-[34%] w-[34%] rounded-full bg-(--accent-text)/35" />
            </div>
        </div>
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
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<RTCDataChannel | null>(null);
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

    const disconnect = useCallback((resetState: boolean) => {
        generationRef.current += 1;
        releaseAll();
        channelRef.current?.close();
        channelRef.current = null;
        peerRef.current?.close();
        peerRef.current = null;
        if (resetState) {
            setStatus("idle");
            setSystem(null);
            setMessage("Enter a pairing code to reconnect.");
        }
    }, [releaseAll]);

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
                    setStatus("connected");
                    setMessage("Connected. Your phone is now the controller.");
                });
                channel.addEventListener("close", () => {
                    releaseAll();
                    if (generation !== generationRef.current) return;
                    setStatus("error");
                    setMessage("The emulator disconnected.");
                });
            });
            peer.addEventListener("connectionstatechange", () => {
                if (
                    generation !== generationRef.current ||
                    peer.connectionState !== "failed"
                ) return;
                releaseAll();
                setStatus("error");
                setMessage("Unable to establish a direct controller connection.");
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
            setStatus("error");
            setMessage(error instanceof Error ? error.message : String(error));
        }
    }, [code, disconnect, releaseAll]);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") releaseAll();
        };
        window.addEventListener("pagehide", releaseAll);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.removeEventListener("pagehide", releaseAll);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            disconnect(false);
        };
    }, [disconnect, releaseAll]);

    const connected = status === "connected" && system !== null;
    const buttons = system ? SYSTEM_BUTTONS[system] : [];
    const hasShoulders = system === "gba";

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
                    <Link
                        href="/"
                        className="rounded-lg border border-(--border) px-3 py-1.5 text-xs font-bold text-(--muted)"
                    >
                        Systems
                    </Link>
                </header>

                <section className="mt-2 shrink-0 rounded-xl border border-(--border) bg-(--panel) p-2 sm:px-3">
                    {connected ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-(--success)" />
                                    <span className="text-xs font-black text-(--success)">
                                        Connected
                                    </span>
                                    {system && (
                                        <span className="rounded-md bg-(--panel-2) px-2 py-0.5 text-[10px] font-black uppercase text-(--accent)">
                                            {system}
                                        </span>
                                    )}
                                </div>
                                <p className="truncate text-[10px] text-(--muted)">
                                    Your phone is now the controller.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => disconnect(true)}
                                className="shrink-0 rounded-lg border border-(--danger) px-3 py-1.5 text-xs font-bold text-(--danger)"
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-end gap-2">
                            <label
                                htmlFor="pairing-code"
                                className="min-w-0 flex-1 text-[9px] font-black uppercase tracking-[0.16em] text-(--muted)"
                            >
                                Pairing code
                                <input
                                    id="pairing-code"
                                    value={code}
                                    onChange={(event) => {
                                        setCode(
                                            event.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 6),
                                        );
                                    }}
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    disabled={
                                        status === "connecting" ||
                                        status === "waiting"
                                    }
                                    className="mt-1 w-full rounded-lg border border-(--border) bg-(--panel-2) px-3 py-1.5 text-center font-mono text-base font-black tracking-[0.18em]"
                                    placeholder="000000"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={() => void connect()}
                                disabled={
                                    status === "connecting" ||
                                    status === "waiting"
                                }
                                className="rounded-lg bg-(--accent) px-4 py-2 text-xs font-bold text-(--accent-text) disabled:opacity-40"
                            >
                                Connect
                            </button>
                            <span className="hidden min-w-0 flex-1 truncate text-[10px] text-(--muted) sm:block" role="status">
                                {message}
                            </span>
                        </div>
                    )}
                </section>

                <section
                    className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-(--border) bg-(--panel) p-2 sm:p-3"
                    aria-label="Virtual controller"
                >
                    <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-(--warning) landscape:hidden">
                        Rotate your phone for the landscape controller
                    </p>

                    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[clamp(0.35rem,2.5vw,2rem)]">
                        <div className="flex min-w-0 flex-col items-center justify-center gap-2">
                            {hasShoulders && (
                                <ControllerButton
                                    label="L"
                                    button="L"
                                    onPress={press}
                                    onRelease={release}
                                    disabled={!connected}
                                />
                            )}
                            <VirtualJoystick
                                key={connected ? "connected" : "disconnected"}
                                onPress={press}
                                onRelease={release}
                                disabled={!connected}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <ControllerButton
                                label="Select"
                                button="SELECT"
                                onPress={press}
                                onRelease={release}
                                disabled={!connected}
                            />
                            <ControllerButton
                                label="Start"
                                button="START"
                                onPress={press}
                                onRelease={release}
                                disabled={!connected}
                            />
                        </div>

                        <div className="flex min-w-0 flex-col items-center justify-center gap-2">
                            {hasShoulders && (
                                <ControllerButton
                                    label="R"
                                    button="R"
                                    onPress={press}
                                    onRelease={release}
                                    disabled={!connected}
                                />
                            )}
                            <div className="flex items-center justify-center gap-[clamp(0.35rem,1.5vw,0.75rem)]">
                                <ControllerButton
                                    label="B"
                                    button="B"
                                    onPress={press}
                                    onRelease={release}
                                    disabled={!connected}
                                    round
                                />
                                <div className="-translate-y-[18%]">
                                    <ControllerButton
                                        label="A"
                                        button="A"
                                        onPress={press}
                                        onRelease={release}
                                        disabled={!connected}
                                        round
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {system && (
                        <div className="sr-only">
                            Available buttons: {buttons.join(", ")}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
