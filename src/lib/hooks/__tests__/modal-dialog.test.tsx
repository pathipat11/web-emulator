import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useModalDialog } from "@/lib/hooks/useModalDialog";

function DialogHarness() {
    const [open, setOpen] = useState(false);
    const dialogRef = useModalDialog<HTMLDivElement>(open, () => setOpen(false));

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>
                Open
            </button>
            {open && (
                <div ref={dialogRef} role="dialog" tabIndex={-1}>
                    <button type="button" data-autofocus>
                        First
                    </button>
                    <button type="button">Last</button>
                </div>
            )}
        </>
    );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        callback(performance.now());
        return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<DialogHarness />));
});

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container = null;
});

describe("useModalDialog", () => {
    it("locks scrolling, focuses the dialog, and restores focus after Escape", () => {
        const openButton = container?.querySelector<HTMLButtonElement>("button");
        expect(openButton).toBeTruthy();

        act(() => {
            openButton?.focus();
            openButton?.click();
        });

        const dialog = container?.querySelector<HTMLElement>("[role='dialog']");
        const firstButton = dialog?.querySelector<HTMLButtonElement>("[data-autofocus]");
        expect(document.body.style.overflow).toBe("hidden");
        expect(document.activeElement).toBe(firstButton);

        act(() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        });

        expect(container?.querySelector("[role='dialog']")).toBeNull();
        expect(document.body.style.overflow).toBe("");
        expect(document.activeElement).toBe(openButton);
    });

    it("keeps Tab focus inside the dialog", () => {
        const openButton = container?.querySelector<HTMLButtonElement>("button");
        act(() => openButton?.click());

        const buttons = container?.querySelectorAll<HTMLButtonElement>("[role='dialog'] button");
        const firstButton = buttons?.[0];
        const lastButton = buttons?.[1];
        lastButton?.focus();

        act(() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
        });

        expect(document.activeElement).toBe(firstButton);
    });
});
