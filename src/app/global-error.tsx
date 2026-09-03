"use client";

import { EmulatorErrorScreen } from "@/components/emulator/EmulatorErrorScreen";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en" data-theme="dark">
            <body>
                <EmulatorErrorScreen
                    error={error}
                    reset={reset}
                />
            </body>
        </html>
    );
}
