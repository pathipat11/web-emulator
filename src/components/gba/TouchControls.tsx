"use client";

import type { GbaButton } from "@/lib/input";

function TouchButton({
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
            className={
                "touch-none select-none rounded-2xl border border-(--border) bg-(--panel) px-3 py-3 text-center text-sm font-semibold shadow-sm active:scale-[0.98] " +
                className
            }
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

/** Mobile overlay: D-pad */
export function DPad({
    onPress,
    onRelease,
}: {
    onPress: (b: GbaButton) => void;
    onRelease: (b: GbaButton) => void;
}) {
    return (
        <div className="rounded-3xl border border-(--border) bg-(--panel)/70 p-3 backdrop-blur">
            <div className="grid grid-cols-3 gap-2">
                <div />
                <TouchButton label="↑" onPress={() => onPress("UP")} onRelease={() => onRelease("UP")} />
                <div />
                <TouchButton label="←" onPress={() => onPress("LEFT")} onRelease={() => onRelease("LEFT")} />
                <TouchButton label="↓" onPress={() => onPress("DOWN")} onRelease={() => onRelease("DOWN")} />
                <TouchButton label="→" onPress={() => onPress("RIGHT")} onRelease={() => onRelease("RIGHT")} />
            </div>
        </div>
    );
}

/** Mobile overlay: A/B + L/R */
export function ABCluster({
    onPress,
    onRelease,
}: {
    onPress: (b: GbaButton) => void;
    onRelease: (b: GbaButton) => void;
}) {
    return (
        <div className="rounded-3xl border border-(--border) bg-(--panel)/70 p-3 backdrop-blur">
            <div className="grid grid-cols-2 gap-2">
                <TouchButton label="A" onPress={() => onPress("A")} onRelease={() => onRelease("A")} />
                <TouchButton label="B" onPress={() => onPress("B")} onRelease={() => onRelease("B")} />
                <TouchButton label="L" onPress={() => onPress("L")} onRelease={() => onRelease("L")} />
                <TouchButton label="R" onPress={() => onPress("R")} onRelease={() => onRelease("R")} />
            </div>
        </div>
    );
}

/** Mobile overlay: Start/Select */
export function StartSelect({
    onPress,
    onRelease,
}: {
    onPress: (b: GbaButton) => void;
    onRelease: (b: GbaButton) => void;
}) {
    return (
        <div className="flex gap-2">
            <TouchButton
                label="SELECT"
                className="px-4 py-3 text-xs"
                onPress={() => onPress("SELECT")}
                onRelease={() => onRelease("SELECT")}
            />
            <TouchButton
                label="START"
                className="px-4 py-3 text-xs"
                onPress={() => onPress("START")}
                onRelease={() => onRelease("START")}
            />
        </div>
    );
}