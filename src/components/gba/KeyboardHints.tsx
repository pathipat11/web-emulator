"use client";

export function KeyRow({ k, v }: { k: string; v: string }) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-(--border) bg-(--panel) px-3 py-2">
            <span className="text-(--muted)">{k}</span>
            <span className="font-medium">{v}</span>
        </div>
    );
}

export function KeyboardHintsGrid() {
    return (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <KeyRow k="Arrow Keys" v="D-Pad" />
            <KeyRow k="Z" v="A" />
            <KeyRow k="X" v="B" />
            <KeyRow k="A" v="L" />
            <KeyRow k="S" v="R" />
            <KeyRow k="Enter" v="START" />
            <KeyRow k="Shift" v="SELECT" />
        </div>
    );
}