"use client";

import { useEffect, useState } from "react";
import type { GbaCore } from "@/lib/gba/core-adapter";
import type { TurboRate } from "@/lib/gba/core-adapter";

export function useTurbo(coreRef: React.RefObject<GbaCore | null>) {
    const [turbo, setTurbo] = useState<TurboRate>(1);

    useEffect(() => {
        coreRef.current?.setTurbo?.(turbo);
    }, [turbo, coreRef]);

    return { turbo, setTurbo };
}