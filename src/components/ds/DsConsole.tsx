"use client";

/**
 * DS dual-screen console display.
 *
 * Before a ROM is loaded: shows two placeholder canvases (top + bottom).
 * After a ROM is loaded: the core adapter replaces this container with
 * an EmulatorJS iframe that handles rendering, input, and audio.
 */
export function DsConsole({
    topCanvasRef,
    bottomCanvasRef,
    status,
}: {
    topCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    bottomCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    status: "idle" | "running" | "paused";
}) {
    return (
        <div className="mt-4 mx-auto max-w-lg" id="ds-console-container">
            {/* Top screen */}
            <div
                className="relative w-full overflow-hidden rounded-t-2xl bg-(--screen) scanlines"
                style={{
                    boxShadow: `0 0 0 1px rgba(255,255,255,.06), 0 0 24px var(--screen-glow)`,
                }}
            >
                <div className="aspect-4/3 w-full">
                    <canvas
                        ref={topCanvasRef}
                        width={256}
                        height={192}
                        className="h-full w-full pixel-perfect"
                    />
                </div>

                {status === "paused" && (
                    <div className="absolute inset-0 grid place-items-center bg-black/50">
                        <div className="rounded-2xl bg-black/70 px-4 py-2 text-sm font-semibold text-white">
                            PAUSED
                        </div>
                    </div>
                )}
            </div>

            {/* Hinge / separator */}
            <div className="h-1.5 bg-(--border)" />

            {/* Bottom screen */}
            <div
                className="relative w-full overflow-hidden rounded-b-2xl bg-(--screen)"
                style={{
                    boxShadow: `0 0 0 1px rgba(255,255,255,.06), 0 0 16px var(--screen-glow)`,
                }}
            >
                <div className="aspect-4/3 w-full">
                    <canvas
                        ref={bottomCanvasRef}
                        width={256}
                        height={192}
                        className="h-full w-full pixel-perfect touch-none"
                    />
                </div>
                <div className="absolute bottom-2 right-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/50">
                    Touch
                </div>
            </div>
        </div>
    );
}
