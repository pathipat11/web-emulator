import type { SerializedSessionDescription } from "@/lib/phone-controller/types";

export async function waitForIceGathering(
    peer: RTCPeerConnection,
    timeoutMs = 5_000,
) {
    if (peer.iceGatheringState === "complete") return;

    await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            peer.removeEventListener("icegatheringstatechange", onChange);
            resolve();
        };
        const onChange = () => {
            if (peer.iceGatheringState === "complete") finish();
        };
        const timeout = window.setTimeout(finish, timeoutMs);
        peer.addEventListener("icegatheringstatechange", onChange);
    });
}

export function serializeDescription(
    description: RTCSessionDescription | RTCSessionDescriptionInit | null,
): SerializedSessionDescription {
    if (
        !description ||
        (description.type !== "offer" && description.type !== "answer") ||
        !description.sdp
    ) {
        throw new Error("WebRTC did not produce a valid session description.");
    }
    return {
        type: description.type,
        sdp: description.sdp,
    };
}
