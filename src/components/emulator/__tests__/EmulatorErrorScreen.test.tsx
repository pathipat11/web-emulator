import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmulatorErrorScreen } from "@/components/emulator/EmulatorErrorScreen";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container = null;
    vi.restoreAllMocks();
});

describe("EmulatorErrorScreen", () => {
    it("offers route recovery, full reload, and a safe way home", () => {
        const reset = vi.fn();
        const reload = vi.fn();
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        act(() => {
            root?.render(
                <EmulatorErrorScreen
                    error={Object.assign(new Error("private failure"), {
                        digest: "error-123",
                    })}
                    reset={reset}
                    systemName="Nintendo DS"
                    onReload={reload}
                />,
            );
        });

        expect(container?.textContent).toContain("Nintendo DS");
        expect(container?.textContent).toContain("Unable to continue");
        expect(container?.textContent).toContain("Reference: error-123");
        expect(container?.textContent).not.toContain("private failure");

        const buttons = container?.querySelectorAll<HTMLButtonElement>("button");
        act(() => buttons?.[0]?.click());
        act(() => buttons?.[1]?.click());

        expect(reset).toHaveBeenCalledOnce();
        expect(reload).toHaveBeenCalledOnce();
        expect(
            container?.querySelector<HTMLAnchorElement>('a[href="/"]'),
        ).toBeTruthy();
    });
});
