"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
    PhoneControlMessage,
    PhoneControllerSystem,
    SerializedSessionDescription,
} from "@/lib/phone-controller/types";
import {
    serializeDescription,
    waitForIceGathering,
} from "@/lib/phone-controller/webrtc";

type ControllableCore<B extends string> = {
    press(button: B): void;
    release(button: B): void;
};

export type PhoneControllerStatus =
    | "idle"
    | "creating"
    | "waiting"
    | "connected"
    | "error";

export type PhoneControllerState = {
    status: PhoneControllerStatus;
    code: string;
    pairingUrl: string;
    message: string;
};

const INITIAL_STATE: PhoneControllerState = {
    status: "idle",
    code: "",
    pairingUrl: "",
    message: "Create a pairing code to connect a phone.",
};

export function usePhoneController<B extends string>({
    coreRef,
    system,
    buttons,
}: {
    coreRef: React.RefObject<ControllableCore<B> | null>;
    system: PhoneControllerSystem;
    buttons: readonly B[];
}) {
    const [state, setState] = useState<PhoneControllerState>(INITIAL_STATE);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<RTCDataChannel | null>(null);
    const pollTimerRef = useRef<number | null>(null);
    const heartbeatTimerRef = useRef<number | null>(null);
    const lastHeartbeatRef = useRef(0);
    const sessionRef = useRef<{ code: string; hostToken: string } | null>(null);
    const pressedButtonsRef = useRef(new Set<B>());
    const generationRef = useRef(0);
    const allowedButtons = useMemo(() => new Set<string>(buttons), [buttons]);

    const releaseAll = useCallback(() => {
        const core = coreRef.current;
        if (core) {
            for (const button of pressedButtonsRef.current) core.release(button);
        }
        pressedButtonsRef.current.clear();
    }, [coreRef]);

    const stopHeartbeatWatch = useCallback(() => {
        if (heartbeatTimerRef.current === null) return;
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
    }, []);

    const dispose = useCallback(
        (resetState: boolean) => {
            generationRef.current += 1;
            stopHeartbeatWatch();
            if (pollTimerRef.current !== null) {
                window.clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }

            const session = sessionRef.current;
            sessionRef.current = null;
            if (session) {
                void fetch(
                    `/api/controller/sessions/${session.code}?token=${encodeURIComponent(session.hostToken)}`,
                    {
                        method: "DELETE",
                        keepalive: true,
                    },
                );
            }

            channelRef.current?.close();
            channelRef.current = null;
            peerRef.current?.close();
            peerRef.current = null;
            releaseAll();
            if (resetState) setState(INITIAL_STATE);
        },
        [releaseAll, stopHeartbeatWatch],
    );

    const handleMessage = useCallback(
        (event: MessageEvent<string>) => {
            let message: PhoneControlMessage;
            try {
                message = JSON.parse(event.data) as PhoneControlMessage;
            } catch {
                return;
            }

            lastHeartbeatRef.current = Date.now();
            if (message.type === "heartbeat") return;
            if (message.type === "release-all") {
                releaseAll();
                return;
            }
            if (!allowedButtons.has(message.button)) return;

            const button = message.button as B;
            const core = coreRef.current;
            if (!core) return;

            if (message.type === "press") {
                if (pressedButtonsRef.current.has(button)) return;
                pressedButtonsRef.current.add(button);
                core.press(button);
            } else if (message.type === "release") {
                pressedButtonsRef.current.delete(button);
                core.release(button);
            }
        },
        [allowedButtons, coreRef, releaseAll],
    );

    const startPairing = useCallback(async () => {
        dispose(false);
        const generation = generationRef.current;
        setState({
            status: "creating",
            code: "",
            pairingUrl: "",
            message: "Creating a secure peer-to-peer session...",
        });

        try {
            if (typeof RTCPeerConnection === "undefined") {
                throw new Error("This browser does not support WebRTC.");
            }

            const peer = new RTCPeerConnection();
            const channel = peer.createDataChannel("web-emulator-controls", {
                ordered: true,
            });
            peerRef.current = peer;
            channelRef.current = channel;

            channel.addEventListener("message", handleMessage);
            channel.addEventListener("open", () => {
                if (generation !== generationRef.current) return;
                if (pollTimerRef.current !== null) {
                    window.clearInterval(pollTimerRef.current);
                    pollTimerRef.current = null;
                }
                const session = sessionRef.current;
                sessionRef.current = null;
                if (session) {
                    void fetch(
                        `/api/controller/sessions/${session.code}?token=${encodeURIComponent(session.hostToken)}`,
                        { method: "DELETE", keepalive: true },
                    );
                }
                lastHeartbeatRef.current = Date.now();
                stopHeartbeatWatch();
                heartbeatTimerRef.current = window.setInterval(() => {
                    if (Date.now() - lastHeartbeatRef.current > 5_000) {
                        releaseAll();
                    }
                }, 1_000);
                setState((current) => ({
                    ...current,
                    status: "connected",
                    message: "Phone controller connected.",
                }));
            });
            channel.addEventListener("close", () => {
                stopHeartbeatWatch();
                releaseAll();
                if (generation !== generationRef.current) return;
                setState((current) => (
                    current.status === "connected"
                        ? {
                            ...current,
                            status: "error",
                            message: "Phone controller disconnected.",
                        }
                        : current
                ));
            });
            peer.addEventListener("connectionstatechange", () => {
                if (generation !== generationRef.current) return;
                if (peer.connectionState === "disconnected") {
                    releaseAll();
                    setState((current) => ({
                        ...current,
                        message: "Connection interrupted. Waiting for the phone...",
                    }));
                } else if (peer.connectionState === "connected") {
                    setState((current) => (
                        current.status === "connected"
                            ? {
                                ...current,
                                message: "Phone controller connected.",
                            }
                            : current
                    ));
                } else if (peer.connectionState === "failed") {
                    stopHeartbeatWatch();
                    releaseAll();
                    setState((current) => ({
                        ...current,
                        status: "error",
                        message: "Unable to restore the phone controller connection.",
                    }));
                }
            });

            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            await waitForIceGathering(peer);

            const response = await fetch("/api/controller/sessions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    system,
                    offer: serializeDescription(peer.localDescription),
                }),
            });
            const result = await response.json() as {
                code?: string;
                hostToken?: string;
                error?: string;
            };
            if (!response.ok || !result.code || !result.hostToken) {
                throw new Error(result.error || "Unable to create a pairing session.");
            }
            if (generation !== generationRef.current) return;

            sessionRef.current = {
                code: result.code,
                hostToken: result.hostToken,
            };
            setState({
                status: "waiting",
                code: result.code,
                pairingUrl: `${window.location.origin}/controller?code=${result.code}`,
                message: "Scan the QR code or enter the pairing code on your phone.",
            });

            let pollInProgress = false;
            const pollForAnswer = async () => {
                if (
                    pollInProgress ||
                    generation !== generationRef.current ||
                    !sessionRef.current
                ) return;
                pollInProgress = true;
                try {
                    const session = sessionRef.current;
                    const answerResponse = await fetch(
                        `/api/controller/sessions/${session.code}/answer?token=${encodeURIComponent(session.hostToken)}`,
                        { cache: "no-store" },
                    );
                    const answerResult = await answerResponse.json() as {
                        answer?: SerializedSessionDescription | null;
                        error?: string;
                    };
                    if (!answerResponse.ok) {
                        throw new Error(
                            answerResult.error || "Pairing session expired.",
                        );
                    }
                    if (answerResult.answer && !peer.remoteDescription) {
                        await peer.setRemoteDescription(answerResult.answer);
                        setState((current) => ({
                            ...current,
                            message: "Phone found. Establishing the direct connection...",
                        }));
                    }
                } catch (error) {
                    if (generation !== generationRef.current) return;
                    if (pollTimerRef.current !== null) {
                        window.clearInterval(pollTimerRef.current);
                        pollTimerRef.current = null;
                    }
                    setState((current) => ({
                        ...current,
                        status: "error",
                        message: error instanceof Error
                            ? error.message
                            : String(error),
                    }));
                } finally {
                    pollInProgress = false;
                }
            };

            pollTimerRef.current = window.setInterval(() => {
                void pollForAnswer();
            }, 750);
            void pollForAnswer();
        } catch (error) {
            if (generation !== generationRef.current) return;
            channelRef.current?.close();
            peerRef.current?.close();
            channelRef.current = null;
            peerRef.current = null;
            setState({
                status: "error",
                code: "",
                pairingUrl: "",
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }, [
        dispose,
        handleMessage,
        releaseAll,
        stopHeartbeatWatch,
        system,
    ]);

    const stopPairing = useCallback(() => {
        dispose(true);
    }, [dispose]);

    useEffect(() => {
        return () => dispose(false);
    }, [dispose]);

    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") releaseAll();
        };
        window.addEventListener("pagehide", releaseAll);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.removeEventListener("pagehide", releaseAll);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [releaseAll]);

    return {
        state,
        startPairing,
        stopPairing,
    };
}
