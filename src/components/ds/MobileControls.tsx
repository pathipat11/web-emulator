"use client";

import type { DsButton } from "@/lib/ds/input";

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
    onPress: (b: DsButton) => void;
    onRelease: (b: DsButton) => void;
};

/**
 * Mobile touch controls for DS — L/R shoulders, D-Pad, A/B/X/Y, Start/Select.
 */
export function DsMobileControls({ onPress, onRelease }: Props) {
    return (
        <div className="mt-4 lg:hidden">
            {/* L / R shoulder buttons */}
            <div className="mb-3 flex justify-between px-2">
                <Btn label="L" className="px-6 py-2 text-sm" onPress={() => onPress("L")} onRelease={() => onRelease("L")} />
                <Btn label="R" className="px-6 py-2 text-sm" onPress={() => onPress("R")} onRelease={() => onRelease("R")} />
            </div>

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

                {/* A / B / X / Y diamond */}
                <div className="grid grid-cols-3 grid-rows-3 gap-1">
                    <div />
                    <Btn label="X" className="h-10 w-10 rounded-full text-xs" onPress={() => onPress("X")} onRelease={() => onRelease("X")} />
                    <div />
                    <Btn label="Y" className="h-10 w-10 rounded-full text-xs bg-(--accent-2) border-transparent" onPress={() => onPress("Y")} onRelease={() => onRelease("Y")} />
                    <div />
                    <Btn label="A" className="h-10 w-10 rounded-full text-xs bg-(--accent) border-transparent" onPress={() => onPress("A")} onRelease={() => onRelease("A")} />
                    <div />
                    <Btn label="B" className="h-10 w-10 rounded-full text-xs" onPress={() => onPress("B")} onRelease={() => onRelease("B")} />
                    <div />
                </div>
            </div>
        </div>
    );
}
