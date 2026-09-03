import { expect, test, type Page } from "@playwright/test";

type SystemCase = {
    path: string;
    heading: string;
    extension: string;
    hasQuickMenu: boolean;
};

const systems: SystemCase[] = [
    {
        path: "/gba",
        heading: "Game Boy Advance",
        extension: ".gba",
        hasQuickMenu: true,
    },
    {
        path: "/nes",
        heading: "Nintendo NES",
        extension: ".nes",
        hasQuickMenu: true,
    },
    {
        path: "/ds",
        heading: "Nintendo DS",
        extension: ".nds",
        hasQuickMenu: false,
    },
];

function collectRenderingErrors(page: Page) {
    const errors: string[] = [];
    const renderingErrorPattern =
        /hydration failed|server rendered text didn't match|encountered a script tag/i;

    page.on("console", (message) => {
        if (
            (message.type() === "error" || message.type() === "warning") &&
            renderingErrorPattern.test(message.text())
        ) {
            errors.push(message.text());
        }
    });
    page.on("pageerror", (error) => {
        if (renderingErrorPattern.test(error.message)) {
            errors.push(error.message);
        }
    });

    return errors;
}

for (const system of systems) {
    test(`${system.heading} shell supports its primary navigation`, async ({ page }) => {
        const renderingErrors = collectRenderingErrors(page);

        await page.goto(system.path);
        await expect(
            page.getByRole("heading", { name: system.heading }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Load ROM" })).toBeVisible();

        const romInput = page.locator(`input[type="file"][accept="${system.extension}"]`);
        await expect(romInput).toHaveCount(1);

        await page.getByRole("button", { name: "Library" }).click();
        await expect(page.getByText("Library is empty")).toBeVisible();
        await expect(page.getByText(`${system.extension} files only`)).toBeVisible();

        await page.getByRole("button", { name: "Player" }).click();
        await expect(page.getByRole("button", { name: "Focus mode" })).toBeVisible();

        await page.getByRole("button", { name: "Focus mode" }).click();
        await expect(page.getByRole("button", { name: "Show interface" })).toBeVisible();
        await page.getByRole("button", { name: "Show interface" }).click();
        await expect(
            page.getByRole("heading", { name: system.heading }),
        ).toBeVisible();

        if (system.hasQuickMenu) {
            await page.getByRole("button", { name: "Quick Menu" }).click();
            const dialog = page.getByRole("dialog", { name: "Quick Menu" });
            await expect(dialog).toBeVisible();
            await dialog.getByRole("button", { name: "Close quick menu" }).click();
            await expect(dialog).toBeHidden();
        } else {
            const fullscreenButtons = page.getByRole("button", { name: "Fullscreen" });
            await expect(fullscreenButtons).toHaveCount(2);
            for (const button of await fullscreenButtons.all()) {
                await expect(button).toBeDisabled();
            }
        }

        expect(renderingErrors).toEqual([]);
    });
}
