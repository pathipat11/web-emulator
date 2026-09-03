import { NextResponse } from "next/server";

import {
    getClientIdentifier,
    rateLimitResponse,
    signalingErrorResponse,
} from "@/lib/phone-controller/api-utils";
import {
    checkControllerRateLimit,
    getControllerAnswer,
    getControllerSession,
    setControllerAnswer,
} from "@/lib/phone-controller/signaling-store";
import type { SerializedSessionDescription } from "@/lib/phone-controller/types";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ code: string }>;
};

function normalizeCode(value: string) {
    return /^\d{6}$/.test(value) ? value : null;
}

function isAnswer(value: unknown): value is SerializedSessionDescription {
    if (!value || typeof value !== "object") return false;
    const candidate = value as { type?: unknown; sdp?: unknown };
    return (
        candidate.type === "answer" &&
        typeof candidate.sdp === "string" &&
        candidate.sdp.length > 0 &&
        candidate.sdp.length <= 100_000
    );
}

export async function POST(request: Request, context: RouteContext) {
    try {
        const rateLimit = await checkControllerRateLimit(
            "answer",
            getClientIdentifier(request),
            20,
            10 * 60,
        );
        if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

        const { code: rawCode } = await context.params;
        const code = normalizeCode(rawCode);
        if (!code) {
            return NextResponse.json(
                { error: "Invalid pairing code." },
                { status: 400 },
            );
        }

        const session = await getControllerSession(code);
        if (!session) {
            return NextResponse.json(
                { error: "Pairing session not found or expired." },
                { status: 404 },
            );
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 },
            );
        }

        const answer = (body as { answer?: unknown } | null)?.answer;
        if (!isAnswer(answer)) {
            return NextResponse.json(
                { error: "A valid WebRTC answer is required." },
                { status: 400 },
            );
        }

        if (!await setControllerAnswer(code, answer)) {
            return NextResponse.json(
                { error: "This pairing session already has a controller." },
                { status: 409 },
            );
        }

        return NextResponse.json({ accepted: true });
    } catch (error) {
        return signalingErrorResponse(error);
    }
}

export async function GET(request: Request, context: RouteContext) {
    try {
        const { code: rawCode } = await context.params;
        const code = normalizeCode(rawCode);
        const hostToken = new URL(request.url).searchParams.get("token") ?? "";
        if (!code) {
            return NextResponse.json(
                { error: "Invalid pairing code." },
                { status: 400 },
            );
        }

        const session = await getControllerSession(code);
        if (!session || session.hostToken !== hostToken) {
            return NextResponse.json(
                { error: "Pairing session not found." },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                answer: await getControllerAnswer(code, hostToken),
                expiresAt: session.expiresAt,
            },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    } catch (error) {
        return signalingErrorResponse(error);
    }
}
