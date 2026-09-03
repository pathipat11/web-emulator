import { NextResponse } from "next/server";

import {
    getClientIdentifier,
    rateLimitResponse,
    signalingErrorResponse,
} from "@/lib/phone-controller/api-utils";
import {
    checkControllerRateLimit,
    createControllerSession,
} from "@/lib/phone-controller/signaling-store";
import type {
    PhoneControllerSystem,
    SerializedSessionDescription,
} from "@/lib/phone-controller/types";

export const runtime = "nodejs";

function isSystem(value: unknown): value is PhoneControllerSystem {
    return value === "gba" || value === "nes";
}

function isDescription(
    value: unknown,
    type: SerializedSessionDescription["type"],
): value is SerializedSessionDescription {
    if (!value || typeof value !== "object") return false;
    const candidate = value as { type?: unknown; sdp?: unknown };
    return (
        candidate.type === type &&
        typeof candidate.sdp === "string" &&
        candidate.sdp.length > 0 &&
        candidate.sdp.length <= 100_000
    );
}

export async function POST(request: Request) {
    try {
        const rateLimit = await checkControllerRateLimit(
            "create",
            getClientIdentifier(request),
            20,
            10 * 60,
        );
        if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 },
            );
        }

        const candidate = body as { system?: unknown; offer?: unknown } | null;
        if (
            !candidate ||
            !isSystem(candidate.system) ||
            !isDescription(candidate.offer, "offer")
        ) {
            return NextResponse.json(
                { error: "A valid system and WebRTC offer are required." },
                { status: 400 },
            );
        }

        const session = await createControllerSession(
            candidate.system,
            candidate.offer,
        );
        return NextResponse.json(
            {
                code: session.code,
                hostToken: session.hostToken,
                expiresAt: session.expiresAt,
            },
            {
                status: 201,
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        return signalingErrorResponse(error);
    }
}
