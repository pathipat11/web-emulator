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
    test(`${system.heading} shell supports its primary navigation`, async (
        { page },
        testInfo,
    ) => {
        const renderingErrors = collectRenderingErrors(page);
        const isMobileProject = testInfo.project.name === "mobile-chromium";

        await page.goto(system.path);
        await expect(
            page.getByRole("heading", { name: system.heading }),
        ).toBeVisible();

        const romInput = page.locator(
            `input[type="file"][accept="${system.extension}"]`,
        );
        await expect(
            page.getByRole("button", { name: "Load ROM" }),
        ).toHaveCount(0);
        await expect(romInput).toHaveCount(0);

        await page.getByRole("button", { name: "Library" }).click();
        await expect(page.getByText("Library is empty")).toBeVisible();
        await expect(page.getByText(`${system.extension} files only`)).toBeVisible();
        await expect(
            page.getByRole("button", { name: /Add ROM/ }),
        ).toBeVisible();
        await expect(romInput).toHaveCount(1);
        await romInput.setInputFiles({
            name: `library-test${system.extension}`,
            mimeType: "application/octet-stream",
            buffer: Buffer.from([0x52, 0x4f, 0x4d]),
        });
        await expect(
            page.getByText(`Added: library-test${system.extension}`),
        ).toBeVisible();
        await expect(
            page.getByText(`library-test${system.extension}`, {
                exact: true,
            }),
        ).toBeVisible();

        await page.getByRole("button", { name: "Player" }).click();
        await expect(page.getByRole("button", { name: "Focus mode" })).toBeVisible();

        if (isMobileProject && system.hasQuickMenu) {
            await expect(
                page.getByRole("button", { name: "D-Pad Up" }),
            ).toBeVisible();
            await expect(page.getByRole("button", { name: /Audio/ })).toBeHidden();
            await expect(
                page.getByRole("button", { name: "Fullscreen" }),
            ).toBeHidden();
        }

        await page.getByRole("button", { name: "Focus mode" }).click();
        await expect(page.getByRole("button", { name: "Show interface" })).toBeVisible();
        if (isMobileProject && system.hasQuickMenu) {
            await expect(
                page.getByRole("button", { name: "D-Pad Up" }),
            ).toBeVisible();
        }
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

        if (isMobileProject && system.hasQuickMenu) {
            const dimensions = await page.evaluate(() => ({
                viewportHeight: window.innerHeight,
                documentHeight: document.documentElement.scrollHeight,
            }));
            expect(dimensions.documentHeight).toBeLessThanOrEqual(
                dimensions.viewportHeight + 2,
            );
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
    await page.getByRole("button", { name: "Library" }).click();
    await page.locator('input[type="file"][accept=".nds"]').setInputFiles({
        name: "retry-test.nds",
        mimeType: "application/octet-stream",
        buffer: Buffer.from([0x4e, 0x44, 0x53]),
    });
    const retryCard = page
        .getByRole("article")
        .filter({ hasText: "retry-test.nds" });
    await retryCard.getByRole("button", { name: "Play" }).click();

    await expect(page.getByText("Unable to start DS emulator")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(2);
    await page.getByRole("button", { name: "Retry" }).first().click();
    await expect(page.getByText("Unable to start DS emulator")).toBeVisible();

    expect(loaderRequests).toBeGreaterThanOrEqual(2);
    await expect(page.locator('input[type="file"][accept=".nds"]')).toHaveCount(0);
});

test("a phone can pair with the GBA player through WebRTC", async ({
    page,
    context,
}) => {
    await page.goto("/gba");
    await page.getByRole("button", { name: "Quick Menu" }).click();
    const quickMenu = page.getByRole("dialog", { name: "Quick Menu" });
    await quickMenu.getByRole("button", { name: "Phone Controller" }).click();

    const hostDialog = page.getByRole("dialog", { name: "Phone Controller" });
    await expect(hostDialog).toBeVisible();
    const controllerLink = hostDialog.getByRole("link", {
        name: "Open controller",
    });
    await expect(controllerLink).toBeVisible({ timeout: 15_000 });
    const pairingUrl = await controllerLink.getAttribute("href");
    expect(pairingUrl).toBeTruthy();

    const phonePage = await context.newPage();
    await phonePage.setViewportSize({ width: 844, height: 390 });
    await phonePage.goto(pairingUrl!);
    await phonePage.getByRole("button", { name: "Connect" }).click();

    await expect(
        phonePage.getByText("Your phone is now the controller."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(hostDialog.getByText("Connected", { exact: true })).toBeVisible({
        timeout: 15_000,
    });
    await expect(
        phonePage.getByRole("button", { name: "A", exact: true }),
    ).toBeEnabled();
    await expect(
        phonePage.getByRole("button", { name: "L", exact: true }),
    ).toBeEnabled();
    const joystick = phonePage.getByRole("application", {
        name: "Virtual joystick",
    });
    await expect(joystick).toHaveAttribute("aria-disabled", "false");
    await expect(phonePage.getByRole("button", { name: "Up" })).toHaveCount(0);

    const controllerBounds = await phonePage
        .getByRole("region", { name: "Virtual controller" })
        .boundingBox();
    expect(controllerBounds).not.toBeNull();
    expect(controllerBounds!.x).toBeGreaterThanOrEqual(0);
    expect(controllerBounds!.y).toBeGreaterThanOrEqual(0);
    expect(controllerBounds!.x + controllerBounds!.width).toBeLessThanOrEqual(844);
    expect(controllerBounds!.y + controllerBounds!.height).toBeLessThanOrEqual(390);

    await phonePage.close();
});
