"use client";

import type { GbaButton } from "@/lib/input";

function Btn({
    label,
    onPress,
    onRelease,
    className = "",
    ariaLabel,
}: {
    label: string;
    onPress: () => void;
    onRelease: () => void;
    className?: string;
    ariaLabel?: string;
}) {
    return (
        <button
            className={[
                "touch-none select-none rounded-xl border border-transparent bg-(--panel-2)",
                "text-center font-semibold transition active:scale-95 active:border-(--accent-border) active:bg-(--accent) active:text-(--accent-text)",
                className,
            ].join(" ")}
            aria-label={ariaLabel ?? label}
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onPress();
            }}
            onPointerUp={() => onRelease()}
            onPointerCancel={() => onRelease()}
            onPointerLeave={() => onRelease()}
            type="button"
        >
            {label}
        </button>
    );
}

type Props = {
    onPress: (b: GbaButton) => void;
    onRelease: (b: GbaButton) => void;
};

/**
 * Mobile touch controls — rendered below the screen, hidden on lg+.
 * Layout mimics a real GBA: L/R shoulders on top, D-Pad left, A/B right, Start/Select center.
 */
export function MobileControls({ onPress, onRelease }: Props) {
    return (
        <div className="mx-auto mt-2 w-full max-w-xl px-1 lg:hidden">
            <div className="mb-1.5 grid grid-cols-2 gap-10 px-2">
                <Btn
                    label="L"
                    className="h-9 w-full text-xs"
                    onPress={() => onPress("L")}
                    onRelease={() => onRelease("L")}
                />
                <Btn
                    label="R"
                    className="h-9 w-full text-xs"
                    onPress={() => onPress("R")}
                    onRelease={() => onRelease("R")}
                />
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1">
                <div className="mx-auto grid h-28 w-28 grid-cols-3 grid-rows-3 gap-0.5 rounded-full bg-(--panel-2) p-1">
                    <div />
                    <Btn
                        label="↑"
                        ariaLabel="D-Pad Up"
                        className="rounded-t-xl rounded-b-md bg-(--panel-3) text-base"
                        onPress={() => onPress("UP")}
                        onRelease={() => onRelease("UP")}
                    />
                    <div />
                    <Btn
                        label="←"
                        ariaLabel="D-Pad Left"
                        className="rounded-l-xl rounded-r-md bg-(--panel-3) text-base"
                        onPress={() => onPress("LEFT")}
                        onRelease={() => onRelease("LEFT")}
                    />
                    <Btn
                        label="↓"
                        ariaLabel="D-Pad Down"
                        className="rounded-b-xl rounded-t-md bg-(--panel-3) text-base"
                        onPress={() => onPress("DOWN")}
                        onRelease={() => onRelease("DOWN")}
                    />
                    <Btn
                        label="→"
                        ariaLabel="D-Pad Right"
                        className="rounded-r-xl rounded-l-md bg-(--panel-3) text-base"
                        onPress={() => onPress("RIGHT")}
                        onRelease={() => onRelease("RIGHT")}
                    />
                </div>

                <div className="flex flex-col items-center gap-1.5">
                    <Btn
                        label="Select"
                        className="h-8 min-w-14 px-2 text-[9px] uppercase tracking-wider"
                        onPress={() => onPress("SELECT")}
                        onRelease={() => onRelease("SELECT")}
                    />
                    <Btn
                        label="Start"
                        className="h-8 min-w-14 px-2 text-[9px] uppercase tracking-wider"
                        onPress={() => onPress("START")}
                        onRelease={() => onRelease("START")}
                    />
                </div>

                <div className="mx-auto flex items-center gap-1.5">
                    <Btn
                        label="B"
                        className="h-13 w-13 rounded-full bg-(--accent-2) text-sm text-(--accent-text)"
                        onPress={() => onPress("B")}
                        onRelease={() => onRelease("B")}
                    />
                    <div className="-translate-y-4">
                        <Btn
                            label="A"
                            className="h-13 w-13 rounded-full bg-(--accent) text-sm text-(--accent-text)"
                            onPress={() => onPress("A")}
                            onRelease={() => onRelease("A")}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
