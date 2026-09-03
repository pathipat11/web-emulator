import { webcrypto } from "node:crypto";
import { afterEach } from "vitest";

Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: webcrypto,
});

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
});

afterEach(() => {
    document.body.innerHTML = "";
});
