import { NextResponse } from "next/server";

import {
    getClientIdentifier,
    rateLimitResponse,
    signalingErrorResponse,
} from "@/lib/phone-controller/api-utils";
import {
    checkControllerRateLimit,
    deleteControllerSession,
    getControllerSession,
} from "@/lib/phone-controller/signaling-store";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ code: string }>;
};

function normalizeCode(value: string) {
    return /^\d{6}$/.test(value) ? value : null;
}

export async function GET(request: Request, context: RouteContext) {
    try {
        const rateLimit = await checkControllerRateLimit(
            "lookup",
            getClientIdentifier(request),
            60,
            60,
        );
        if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

        const { code: rawCode } = await context.params;
        const code = normalizeCode(rawCode);
        const session = code ? await getControllerSession(code) : null;
        if (!session) {
            return NextResponse.json(
                { error: "Pairing session not found or expired." },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                system: session.system,
                offer: session.offer,
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

export async function DELETE(request: Request, context: RouteContext) {
    try {
        const { code: rawCode } = await context.params;
        const code = normalizeCode(rawCode);
        const hostToken = new URL(request.url).searchParams.get("token") ?? "";
        if (!code || !await deleteControllerSession(code, hostToken)) {
            return NextResponse.json(
                { error: "Pairing session not found." },
                { status: 404 },
            );
        }
        return new Response(null, { status: 204 });
    } catch (error) {
        return signalingErrorResponse(error);
    }
}
