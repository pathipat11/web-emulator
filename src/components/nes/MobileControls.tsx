"use client";

import type { NesButton } from "@/lib/nes/input";

function Btn({
    label,
    onPress,
    onRelease,
    className = "",
}: {
    label: string;
    onPress: () => void;
    onRelease: () => void;
    className?: string;
}) {
    return (
        <button
            className={[
                "touch-none select-none rounded-2xl border border-(--border) bg-(--panel)",
                "text-center font-semibold shadow-sm active:scale-95 active:bg-(--panel-2) transition-transform",
                className,
            ].join(" ")}
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
    onPress: (b: NesButton) => void;
    onRelease: (b: NesButton) => void;
};

/**
 * Mobile touch controls for NES — D-Pad left, A/B right, Start/Select center.
 * No L/R shoulders since NES doesn't have them.
 */
export function NesMobileControls({ onPress, onRelease }: Props) {
    return (
        <div className="mt-4 lg:hidden">
            <div className="flex items-center justify-between gap-3 px-2">
                {/* D-Pad */}
                <div className="grid grid-cols-3 gap-1.5">
                    <div />
                    <Btn label="↑" className="h-11 w-11 text-base" onPress={() => onPress("UP")} onRelease={() => onRelease("UP")} />
                    <div />
                    <Btn label="←" className="h-11 w-11 text-base" onPress={() => onPress("LEFT")} onRelease={() => onRelease("LEFT")} />
                    <Btn label="↓" className="h-11 w-11 text-base" onPress={() => onPress("DOWN")} onRelease={() => onRelease("DOWN")} />
                    <Btn label="→" className="h-11 w-11 text-base" onPress={() => onPress("RIGHT")} onRelease={() => onRelease("RIGHT")} />
                </div>

                {/* Start / Select */}
                <div className="flex flex-col items-center gap-2">
                    <Btn label="SELECT" className="px-4 py-1.5 text-[10px] tracking-wider" onPress={() => onPress("SELECT")} onRelease={() => onRelease("SELECT")} />
                    <Btn label="START" className="px-4 py-1.5 text-[10px] tracking-wider" onPress={() => onPress("START")} onRelease={() => onRelease("START")} />
                </div>

                {/* A / B */}
                <div className="grid grid-cols-2 grid-rows-2 gap-1.5">
                    <div />
                    <Btn label="A" className="h-12 w-12 rounded-full text-sm bg-(--accent) border-transparent" onPress={() => onPress("A")} onRelease={() => onRelease("A")} />
                    <Btn label="B" className="h-12 w-12 rounded-full text-sm bg-(--accent-2) border-transparent" onPress={() => onPress("B")} onRelease={() => onRelease("B")} />
                    <div />
                </div>
            </div>
        </div>
    );
}
