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
                    ? "grid h-20 w-20 place-items-center rounded-full text-xl"
                    : "min-h-13 rounded-xl px-4 text-xs",
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
        <main className="min-h-dvh bg-(--bg) px-4 py-5 text-(--text)">
            <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-lg flex-col">
                <header className="flex items-center justify-between gap-4">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-(--accent)">
                            Web Emulator Lab
                        </div>
                        <h1 className="mt-1 text-xl font-black">Phone Controller</h1>
                    </div>
                    <Link
                        href="/"
                        className="rounded-xl border border-(--border) px-3 py-2 text-xs font-bold text-(--muted)"
                    >
                        Systems
                    </Link>
                </header>

                <section className="mt-5 rounded-2xl border border-(--border) bg-(--panel) p-4">
                    <label
                        htmlFor="pairing-code"
                        className="text-[10px] font-black uppercase tracking-[0.16em] text-(--muted)"
                    >
                        Pairing code
                    </label>
                    <div className="mt-2 flex gap-2">
                        <input
                            id="pairing-code"
                            value={code}
                            onChange={(event) => {
                                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                            }}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]*"
                            maxLength={6}
                            disabled={status === "connecting" || status === "waiting" || connected}
                            className="min-w-0 flex-1 rounded-xl border border-(--border) bg-(--panel-2) px-4 py-3 text-center font-mono text-xl font-black tracking-[0.2em]"
                            placeholder="000000"
                        />
                        {connected ? (
                            <button
                                type="button"
                                onClick={() => disconnect(true)}
                                className="rounded-xl border border-(--danger) px-4 py-2 text-xs font-bold text-(--danger)"
                            >
                                Disconnect
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => void connect()}
                                disabled={status === "connecting" || status === "waiting"}
                                className="rounded-xl bg-(--accent) px-4 py-2 text-xs font-bold text-(--accent-text) disabled:opacity-40"
                            >
                                Connect
                            </button>
                        )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                        <span className="text-(--muted)" role="status">{message}</span>
                        {system && (
                            <span className="shrink-0 rounded-lg bg-(--panel-2) px-2 py-1 font-black uppercase text-(--accent)">
                                {system}
                            </span>
                        )}
                    </div>
                </section>

                <section
                    className="mt-5 flex flex-1 flex-col justify-between rounded-3xl border border-(--border) bg-(--panel) p-4 sm:p-6"
                    aria-label="Virtual controller"
                >
                    <div className="grid grid-cols-2 gap-3">
                        {hasShoulders && (
                            <>
                                <ControllerButton
                                    label="L"
                                    button="L"
                                    onPress={press}
                                    onRelease={release}
                                    disabled={!connected}
                                />
                                <ControllerButton
                                    label="R"
                                    button="R"
                                    onPress={press}
                                    onRelease={release}
                                    disabled={!connected}
                                />
                            </>
                        )}
                    </div>

                    <div className="my-6 grid grid-cols-2 items-center gap-6">
                        <div className="mx-auto grid w-full max-w-44 grid-cols-3 grid-rows-3 gap-1">
                            <span />
                            <ControllerButton label="Up" button="UP" onPress={press} onRelease={release} disabled={!connected} />
                            <span />
                            <ControllerButton label="Left" button="LEFT" onPress={press} onRelease={release} disabled={!connected} />
                            <span className="rounded-lg bg-(--panel-3)" />
                            <ControllerButton label="Right" button="RIGHT" onPress={press} onRelease={release} disabled={!connected} />
                            <span />
                            <ControllerButton label="Down" button="DOWN" onPress={press} onRelease={release} disabled={!connected} />
                            <span />
                        </div>

                        <div className="flex items-center justify-center gap-3">
                            <ControllerButton label="B" button="B" onPress={press} onRelease={release} disabled={!connected} round />
                            <div className="-mt-16">
                                <ControllerButton label="A" button="A" onPress={press} onRelease={release} disabled={!connected} round />
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto grid w-full max-w-64 grid-cols-2 gap-3">
                        <ControllerButton label="Select" button="SELECT" onPress={press} onRelease={release} disabled={!connected} />
                        <ControllerButton label="Start" button="START" onPress={press} onRelease={release} disabled={!connected} />
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
