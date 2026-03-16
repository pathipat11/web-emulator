/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

export function GbaConsole({
    canvasRef,
    status,
}: {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    status: "idle" | "running" | "paused";
    onPress?: (btn: any) => void;
    onRelease?: (btn: any) => void;
}) {
    return (
        <div className="mt-4">
            <div
                className="relative w-full overflow-hidden rounded-2xl bg-(--screen) scanlines"
                style={{
                    boxShadow: `0 0 0 1px rgba(255,255,255,.06), 0 0 24px var(--screen-glow)`,
                }}
            >
                <div className="aspect-3/2 w-full">
                    <canvas
                        ref={canvasRef}
                        width={240}
                        height={160}
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
        </div>
    );
}
