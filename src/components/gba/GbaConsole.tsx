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
        <div className="mt-5">
            <div className="mx-auto w-full max-w-180">
                <div className="rounded-[40px] border border-(--border) p-6 shadow-xl">
                    <div className="rounded-4xl bg-(--panel-2) p-5 shadow-inner">
                        <div
                            className="relative mx-auto w-full overflow-hidden rounded-3xl bg-(--screen) scanlines"
                            style={{
                                boxShadow: `0 0 0 1px rgba(255,255,255,.06), 0 0 32px var(--screen-glow)`,
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

                        <div className="mt-4 flex items-center justify-between">
                            <div className="text-sm font-semibold tracking-wide text-(--muted)">GBA</div>
                            <div className="text-xs text-(--muted)">240×160 • Pixel Perfect</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}