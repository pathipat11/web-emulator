import { createHash, randomInt, randomUUID } from "node:crypto";

import { Redis } from "@upstash/redis";

import type {
    PhoneControllerSystem,
    SerializedSessionDescription,
} from "@/lib/phone-controller/types";

const SESSION_TTL_SECONDS = 10 * 60;
const MAX_LOCAL_SESSIONS = 250;
const KEY_PREFIX = "web-emulator:phone-controller";

type ControllerSession = {
    code: string;
    hostToken: string;
    system: PhoneControllerSystem;
    offer: SerializedSessionDescription;
    createdAt: number;
    expiresAt: number;
};

type LocalRateLimit = {
    count: number;
    expiresAt: number;
};

type LocalStore = {
    sessions: Map<string, ControllerSession>;
    answers: Map<string, SerializedSessionDescription>;
    rateLimits: Map<string, LocalRateLimit>;
};

export type RateLimitResult = {
    allowed: boolean;
    retryAfterSeconds: number;
};

export class ControllerSignalingConfigurationError extends Error {
    constructor() {
        super(
            "Phone Controller signaling is unavailable. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
        );
        this.name = "ControllerSignalingConfigurationError";
    }
}

const globalStore = globalThis as typeof globalThis & {
    __webEmulatorControllerStore?: LocalStore;
    __webEmulatorControllerRedis?: Redis | null;
};

const localStore =
    globalStore.__webEmulatorControllerStore ??
    {
        sessions: new Map<string, ControllerSession>(),
        answers: new Map<string, SerializedSessionDescription>(),
        rateLimits: new Map<string, LocalRateLimit>(),
    };

globalStore.__webEmulatorControllerStore = localStore;

function getRedis() {
    if (globalStore.__webEmulatorControllerRedis !== undefined) {
        return globalStore.__webEmulatorControllerRedis;
    }

    const url =
        process.env.UPSTASH_REDIS_REST_URL ??
        process.env.KV_REST_API_URL;
    const token =
        process.env.UPSTASH_REDIS_REST_TOKEN ??
        process.env.KV_REST_API_TOKEN;

    if (url && token) {
        globalStore.__webEmulatorControllerRedis = new Redis({ url, token });
        return globalStore.__webEmulatorControllerRedis;
    }

    if (url || token || process.env.VERCEL) {
        throw new ControllerSignalingConfigurationError();
    }

    globalStore.__webEmulatorControllerRedis = null;
    return null;
}

function sessionKey(code: string) {
    return `${KEY_PREFIX}:session:${code}`;
}

function answerKey(code: string) {
    return `${KEY_PREFIX}:answer:${code}`;
}

function rateLimitKey(scope: string, identifier: string) {
    const digest = createHash("sha256").update(identifier).digest("hex").slice(0, 24);
    return `${KEY_PREFIX}:rate:${scope}:${digest}`;
}

function createPairingCode() {
    return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function cleanupLocalStore(now = Date.now()) {
    for (const [code, session] of localStore.sessions) {
        if (session.expiresAt <= now) {
            localStore.sessions.delete(code);
            localStore.answers.delete(code);
        }
    }
    for (const [key, rateLimit] of localStore.rateLimits) {
        if (rateLimit.expiresAt <= now) localStore.rateLimits.delete(key);
    }

    if (localStore.sessions.size <= MAX_LOCAL_SESSIONS) return;
    const oldest = Array.from(localStore.sessions.values())
        .sort((left, right) => left.createdAt - right.createdAt)
        .slice(0, localStore.sessions.size - MAX_LOCAL_SESSIONS);
    for (const session of oldest) {
        localStore.sessions.delete(session.code);
        localStore.answers.delete(session.code);
    }
}

export async function createControllerSession(
    system: PhoneControllerSystem,
    offer: SerializedSessionDescription,
) {
    const redis = getRedis();
    cleanupLocalStore();

    for (let attempt = 0; attempt < 20; attempt += 1) {
        const now = Date.now();
        const session: ControllerSession = {
            code: createPairingCode(),
            hostToken: randomUUID(),
            system,
            offer,
            createdAt: now,
            expiresAt: now + SESSION_TTL_SECONDS * 1000,
        };

        if (redis) {
            const result = await redis.set(sessionKey(session.code), session, {
                ex: SESSION_TTL_SECONDS,
                nx: true,
            });
            if (result === "OK") return session;
        } else if (!localStore.sessions.has(session.code)) {
            localStore.sessions.set(session.code, session);
            return session;
        }
    }

    throw new Error("Unable to allocate a phone controller pairing code.");
}

export async function getControllerSession(code: string) {
    const redis = getRedis();
    if (redis) {
        return await redis.get<ControllerSession>(sessionKey(code));
    }

    cleanupLocalStore();
    return localStore.sessions.get(code) ?? null;
}

export async function setControllerAnswer(
    code: string,
    answer: SerializedSessionDescription,
) {
    const session = await getControllerSession(code);
    if (!session) return null;

    const remainingSeconds = Math.max(
        1,
        Math.ceil((session.expiresAt - Date.now()) / 1000),
    );
    const redis = getRedis();
    if (redis) {
        const result = await redis.set(answerKey(code), answer, {
            ex: remainingSeconds,
            nx: true,
        });
        return result === "OK" ? session : null;
    }

    if (localStore.answers.has(code)) return null;
    localStore.answers.set(code, answer);
    return session;
}

export async function getControllerAnswer(code: string, hostToken: string) {
    const session = await getControllerSession(code);
    if (!session || session.hostToken !== hostToken) return null;

    const redis = getRedis();
    if (redis) {
        return await redis.get<SerializedSessionDescription>(answerKey(code));
    }
    return localStore.answers.get(code) ?? null;
}

export async function deleteControllerSession(
    code: string,
    hostToken: string,
) {
    const session = await getControllerSession(code);
    if (!session || session.hostToken !== hostToken) return false;

    const redis = getRedis();
    if (redis) {
        const deleted = await redis.del(sessionKey(code), answerKey(code));
        return deleted > 0;
    }

    localStore.answers.delete(code);
    return localStore.sessions.delete(code);
}

export async function checkControllerRateLimit(
    scope: string,
    identifier: string,
    limit: number,
    windowSeconds: number,
): Promise<RateLimitResult> {
    const key = rateLimitKey(scope, identifier);
    const redis = getRedis();

    if (redis) {
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSeconds);
        const ttl = count > limit ? await redis.ttl(key) : windowSeconds;
        return {
            allowed: count <= limit,
            retryAfterSeconds: Math.max(1, ttl),
        };
    }

    const now = Date.now();
    cleanupLocalStore(now);
    const current = localStore.rateLimits.get(key);
    const rateLimit = current ?? {
        count: 0,
        expiresAt: now + windowSeconds * 1000,
    };
    rateLimit.count += 1;
    localStore.rateLimits.set(key, rateLimit);
    return {
        allowed: rateLimit.count <= limit,
        retryAfterSeconds: Math.max(
            1,
            Math.ceil((rateLimit.expiresAt - now) / 1000),
        ),
    };
}
