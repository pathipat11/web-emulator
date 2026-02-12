/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
    interface Window {
        mGBA?: any;
    }
}

async function loadScript(src: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}

export async function loadMgbaFactory(): Promise<any> {
    if (typeof window === "undefined") throw new Error("Browser only");
    if (window.mGBA) return window.mGBA;

    // 1) Try ESM import first
    try {
        // @ts-ignore - mgba.js is loaded at runtime from external source
        const mod: any = await import(/* webpackIgnore: true */ "/mgba/mgba.js");
        const factory = mod?.default ?? mod?.mGBA;
        if (factory) {
            window.mGBA = factory;
            return factory;
        }
    } catch {
        // fallback
    }

    // 2) Fallback: normal script tag -> expects global window.mGBA
    await loadScript("/mgba/mgba.js");
    if (!window.mGBA) {
        throw new Error("mGBA factory not found (mgba.js did not expose window.mGBA or default export).");
    }
    return window.mGBA;
}