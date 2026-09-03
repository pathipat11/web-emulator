import { NextResponse } from "next/server";

import {
    ControllerSignalingConfigurationError,
    type RateLimitResult,
} from "@/lib/phone-controller/signaling-store";

export function getClientIdentifier(request: Request) {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown"
    );
}

export function rateLimitResponse(result: RateLimitResult) {
    return NextResponse.json(
        { error: "Too many pairing requests. Try again shortly." },
        {
            status: 429,
            headers: {
                "Cache-Control": "no-store",
                "Retry-After": String(result.retryAfterSeconds),
            },
        },
    );
}

export function signalingErrorResponse(error: unknown) {
    if (error instanceof ControllerSignalingConfigurationError) {
        return NextResponse.json(
            { error: error.message },
            {
                status: 503,
                headers: {
                    "Cache-Control": "no-store",
                },
            },
        );
    }

    console.error("Phone Controller signaling failed.", error);
    return NextResponse.json(
        { error: "Phone Controller signaling is temporarily unavailable." },
        {
            status: 500,
            headers: {
                "Cache-Control": "no-store",
            },
        },
    );
}
