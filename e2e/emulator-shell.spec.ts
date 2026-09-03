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

test("home lists future systems as disabled cards", async ({ page }) => {
    await page.goto("/");

    const futureSystems = [
        {
            title: "PlayStation Portable",
            core: "PPSSPP",
            image: /\/images\/psp\.jpg$/,
        },
        {
            title: "Nintendo 3DS",
            core: "Planned",
            image: /\/images\/3DS\.jpeg$/,
        },
        {
            title: "Nintendo Wii",
            core: "Planned",
            image: /\/images\/Nintendo-Wii\.png$/,
        },
    ];

    for (const system of futureSystems) {
        const card = page
            .getByRole("article")
            .filter({ hasText: system.title });
        await expect(card).toBeVisible();
        await expect(card.getByText(system.core, { exact: true })).toBeVisible();
        await expect(card.getByText("Coming soon")).toBeVisible();
        await expect(card.getByText("Unavailable")).toBeVisible();
        await expect(card.getByRole("link")).toHaveCount(0);
        await expect(card.locator("img")).toHaveAttribute("src", system.image);
    }

    await expect(page.getByText("3 of 9 available")).toBeVisible();
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

        if (system.hasQuickMenu) {
            await expect(
                page.getByText("Ready", { exact: true }),
            ).toHaveCount(1);
            const libraryCard = page
                .getByRole("article")
                .filter({ hasText: `library-test${system.extension}` });
            await libraryCard.getByRole("button", { name: "Play" }).click();

            if (isMobileProject) {
                await expect(
                    page.getByRole("button", { name: "Show interface" }),
                ).toBeVisible();
                await expect(
                    page.getByRole("application", { name: "Virtual joystick" }),
                ).toBeVisible();
                await page
                    .getByRole("button", { name: "Show interface" })
                    .click();
            } else {
                await expect(
                    page.getByRole("button", { name: "Show interface" }),
                ).toHaveCount(0);
            }
        } else {
            await page.getByRole("button", { name: "Player" }).click();
        }

        await expect(page.getByRole("button", { name: "Focus mode" })).toBeVisible();

        if (isMobileProject && system.hasQuickMenu) {
            await expect(
                page.getByRole("application", { name: "Virtual joystick" }),
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
                page.getByRole("application", { name: "Virtual joystick" }),
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

test("Nintendo DS can retry a failed CDN load without selecting the ROM again", async (
    { page },
    testInfo,
) => {
    const isMobileProject = testInfo.project.name === "mobile-chromium";
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

    if (isMobileProject) {
        await expect(
            page.getByRole("button", { name: "Show interface" }),
        ).toBeVisible();
    }
    await expect(page.getByText("Unable to start DS emulator")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(
        isMobileProject ? 1 : 2,
    );
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
    await phonePage
        .getByRole("dialog", { name: "Phone connection" })
        .getByRole("button", { name: "Connect", exact: true })
        .click();

    await expect(hostDialog.getByText("Connected", { exact: true })).toBeVisible({
        timeout: 15_000,
    });
    await expect(
        phonePage.getByRole("button", { name: "A", exact: true }),
    ).toBeEnabled();
    await expect(
        phonePage.getByRole("button", { name: "L", exact: true }),
    ).toBeEnabled();
    await expect(
        phonePage.getByRole("button", { name: "X", exact: true }),
    ).toHaveCount(0);
    await expect(
        phonePage.getByRole("button", { name: "Y", exact: true }),
    ).toHaveCount(0);
    const joystick = phonePage.getByRole("application", {
        name: "Virtual joystick",
    });
    await expect(joystick).toHaveAttribute("aria-disabled", "false");
    await expect(phonePage.getByRole("button", { name: "Up" })).toHaveCount(0);

    const joystickBounds = await joystick.boundingBox();
    expect(joystickBounds).not.toBeNull();
    const joystickThumb = joystick.locator("[data-joystick-thumb]");
    const centeredTransform = await joystickThumb.evaluate(
        (element) => getComputedStyle(element).transform,
    );
    const centerX = joystickBounds!.x + joystickBounds!.width / 2;
    const centerY = joystickBounds!.y + joystickBounds!.height / 2;
    await phonePage.mouse.move(centerX, centerY);
    await phonePage.mouse.down();
    await phonePage.mouse.move(
        centerX - joystickBounds!.width * 0.25,
        centerY,
    );
    await expect.poll(
        () => joystickThumb.evaluate(
            (element) => getComputedStyle(element).transform,
        ),
    ).not.toBe(centeredTransform);
    await phonePage.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect.poll(
        () => joystickThumb.evaluate(
            (element) => getComputedStyle(element).transform,
        ),
    ).toBe(centeredTransform);
    await phonePage.mouse.up();

    const controllerRegion = phonePage.getByRole("region", {
        name: "Virtual controller",
    });
    const controllerBounds = await controllerRegion.boundingBox();
    expect(controllerBounds).not.toBeNull();

    await phonePage.getByRole("button", { name: "Open controller menu" }).click();
    let controllerMenu = phonePage.getByRole("dialog", {
        name: "Controller menu",
    });
    await controllerMenu
        .getByRole("button", { name: "Customize layout" })
        .click();
    await expect(phonePage.getByText("Editing gba landscape")).toBeVisible();

    const moveA = phonePage.getByRole("group", {
        name: "Move A control",
    });
    const moveABounds = await moveA.boundingBox();
    expect(moveABounds).not.toBeNull();
    await phonePage.mouse.move(
        moveABounds!.x + moveABounds!.width / 2,
        moveABounds!.y + moveABounds!.height / 2,
    );
    await phonePage.mouse.down();
    await phonePage.mouse.move(
        controllerBounds!.x + controllerBounds!.width + 100,
        controllerBounds!.y + controllerBounds!.height + 100,
    );
    await phonePage.mouse.up();

    const movedABounds = await moveA.boundingBox();
    expect(movedABounds).not.toBeNull();
    expect(movedABounds!.x).toBeGreaterThanOrEqual(controllerBounds!.x);
    expect(movedABounds!.y).toBeGreaterThanOrEqual(controllerBounds!.y);
    expect(movedABounds!.x + movedABounds!.width).toBeLessThanOrEqual(
        controllerBounds!.x + controllerBounds!.width + 1,
    );
    expect(movedABounds!.y + movedABounds!.height).toBeLessThanOrEqual(
        controllerBounds!.y + controllerBounds!.height + 1,
    );

    await phonePage.getByRole("slider", { name: "Control size" }).fill("120");
    await phonePage
        .getByRole("slider", { name: "Control opacity" })
        .fill("75");
    const savedLayout = await phonePage.evaluate(() => {
        const raw = localStorage.getItem(
            "phone-controller:layout:v1:gba:landscape",
        );
        return raw ? JSON.parse(raw) as {
            scale: number;
            opacity: number;
            positions: { A: { x: number; y: number } };
        } : null;
    });
    expect(savedLayout).not.toBeNull();
    expect(savedLayout!.scale).toBe(1.2);
    expect(savedLayout!.opacity).toBe(0.75);
    expect(savedLayout!.positions.A.x).toBeLessThan(100);
    expect(savedLayout!.positions.A.y).toBeLessThan(100);

    await phonePage.getByRole("button", { name: "Lock layout" }).click();
    await expect(
        phonePage.getByRole("button", { name: "Open controller menu" }),
    ).toBeVisible();
    await expect(
        phonePage.getByRole("button", { name: "A", exact: true }),
    ).toBeEnabled();

    await phonePage.getByRole("button", { name: "Open controller menu" }).click();
    controllerMenu = phonePage.getByRole("dialog", {
        name: "Controller menu",
    });
    await controllerMenu.getByRole("button", { name: /Connection/ }).click();
    const connectionDialog = phonePage.getByRole("dialog", {
        name: "Phone connection",
    });
    await expect(connectionDialog).toBeVisible();
    await expect(
        connectionDialog.getByRole("button", { name: "Disconnect" }),
    ).toBeVisible();
    await connectionDialog
        .getByRole("button", { name: "Close phone connection" })
        .click();
    await expect(connectionDialog).toBeHidden();

    expect(controllerBounds!.x).toBeGreaterThanOrEqual(0);
    expect(controllerBounds!.y).toBeGreaterThanOrEqual(0);
    expect(controllerBounds!.x + controllerBounds!.width).toBeLessThanOrEqual(844);
    expect(controllerBounds!.y + controllerBounds!.height).toBeLessThanOrEqual(390);

    await phonePage.close();
});
