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

test("home lists PlayStation Portable as a disabled future system", async ({
    page,
}) => {
    await page.goto("/");

    const pspCard = page
        .getByRole("article")
        .filter({ hasText: "PlayStation Portable" });
    await expect(pspCard).toBeVisible();
    await expect(pspCard.getByText("PPSSPP", { exact: true })).toBeVisible();
    await expect(pspCard.getByText("Coming soon")).toBeVisible();
    await expect(pspCard.getByText("Unavailable")).toBeVisible();
    await expect(pspCard.getByRole("link")).toHaveCount(0);
    const pspImage = pspCard.locator("img");
    await expect(pspImage).toHaveCount(1);
    await expect(pspImage).toHaveAttribute("src", /\/images\/psp\.jpg$/);
});

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
            await expect(fullscreenButtons).toHaveCount(1);
            await expect(fullscreenButtons).toBeDisabled();
            await expect(page.getByRole("button", { name: "Restart" })).toBeDisabled();
        }

        expect(renderingErrors).toEqual([]);
    });
}

test("Nintendo DS can retry a failed CDN load without selecting the ROM again", async ({
    page,
}) => {
    let loaderRequests = 0;
    await page.route("https://cdn.emulatorjs.org/**/loader.js", async (route) => {
        loaderRequests += 1;
        await route.fulfill({
            contentType: "application/javascript",
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Cross-Origin-Resource-Policy": "cross-origin",
            },
            body: 'throw new Error("Mock CDN failure");',
        });
    });

    await page.goto("/ds");
    await page.locator('input[type="file"][accept=".nds"]').setInputFiles({
        name: "retry-test.nds",
        mimeType: "application/octet-stream",
        buffer: Buffer.from([0x4e, 0x44, 0x53]),
    });

    await expect(page.getByText("Unable to start DS emulator")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(2);
    await page.getByRole("button", { name: "Retry" }).first().click();
    await expect(page.getByText("Unable to start DS emulator")).toBeVisible();

    expect(loaderRequests).toBeGreaterThanOrEqual(2);
    await expect(page.locator('input[type="file"][accept=".nds"]')).toHaveCount(1);
});
