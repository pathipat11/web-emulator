import { describe, expect, it } from "vitest";

import { hashRom } from "@/lib/hashRom";

describe("hashRom", () => {
    it("returns the first 16 hexadecimal characters of SHA-256", async () => {
        await expect(hashRom(new Uint8Array([1, 2, 3]))).resolves.toBe(
            "039058c6f2c0cb49",
        );
    });
});
