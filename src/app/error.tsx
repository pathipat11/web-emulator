"use client";

import { EmulatorErrorScreen } from "@/components/emulator/EmulatorErrorScreen";

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <EmulatorErrorScreen
            error={error}
            reset={reset}
        />
    );
}
