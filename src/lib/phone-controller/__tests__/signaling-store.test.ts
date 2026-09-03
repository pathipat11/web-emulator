import { describe, expect, it } from "vitest";

import {
    checkControllerRateLimit,
    createControllerSession,
    deleteControllerSession,
    getControllerAnswer,
    getControllerSession,
    setControllerAnswer,
} from "@/lib/phone-controller/signaling-store";

const offer = {
    type: "offer" as const,
    sdp: "test-offer",
};

const answer = {
    type: "answer" as const,
    sdp: "test-answer",
};

describe("phone controller signaling store", () => {
    it("creates a six-digit session with an isolated host token", async () => {
        const session = await createControllerSession("gba", offer);

        expect(session.code).toMatch(/^\d{6}$/);
        expect(session.hostToken.length).toBeGreaterThan(20);
        expect((await getControllerSession(session.code))?.system).toBe("gba");
        expect(await getControllerAnswer(session.code, "wrong-token")).toBeNull();
    });

    it("accepts only one controller answer", async () => {
        const session = await createControllerSession("nes", offer);

        expect(await setControllerAnswer(session.code, answer)).not.toBeNull();
        expect(await setControllerAnswer(session.code, answer)).toBeNull();
        expect(
            await getControllerAnswer(session.code, session.hostToken),
        ).toEqual(answer);
    });

    it("requires the host token when deleting a session", async () => {
        const session = await createControllerSession("gba", offer);

        expect(
            await deleteControllerSession(session.code, "wrong-token"),
        ).toBe(false);
        expect(
            await deleteControllerSession(session.code, session.hostToken),
        ).toBe(true);
        expect(await getControllerSession(session.code)).toBeNull();
    });

    it("rate limits repeated pairing requests", async () => {
        const identifier = `test-${Date.now()}-${Math.random()}`;

        expect(
            await checkControllerRateLimit("test", identifier, 2, 60),
        ).toMatchObject({ allowed: true });
        expect(
            await checkControllerRateLimit("test", identifier, 2, 60),
        ).toMatchObject({ allowed: true });
        expect(
            await checkControllerRateLimit("test", identifier, 2, 60),
        ).toMatchObject({ allowed: false });
    });
});
