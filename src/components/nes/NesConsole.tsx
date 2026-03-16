"use client";

export function NesConsole({
    canvasRef,
    status,
}: {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    status: "idle" | "running" | "paused";
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
                            <div className="aspect-4/3 w-full">
                                <canvas
                                    ref={canvasRef}
                                    width={256}
                                    height={240}
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
                            <div className="text-sm font-semibold tracking-wide text-(--muted)">NES</div>
                            <div className="text-xs text-(--muted)">256×240 • Pixel Perfect</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
