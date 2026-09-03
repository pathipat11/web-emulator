"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
    onFile: (file: File) => void;
};

export function NesRomDropzone({ onFile }: Props) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);

    const handleFiles = useCallback(
        (files: FileList | null) => {
            if (!files?.length) return;
            const file = files[0];
            if (!file.name.toLowerCase().endsWith(".nes")) return;
            onFile(file);
        },
        [onFile],
    );

    const onDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounter.current++;
        setDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounter.current--;
        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setDragging(false);
        }
    }, []);

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            dragCounter.current = 0;
            setDragging(false);
            handleFiles(e.dataTransfer.files);
        },
        [handleFiles],
    );

    return (
        <div
            onDragEnter={onDragEnter}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                }
            }}
            className={[
                "cursor-pointer rounded-(--radius) border border-dashed p-4 transition sm:p-5",
                "bg-(--panel) border-(--border) hover:border-(--accent)",
                dragging ? "border-(--accent) bg-(--panel-2)" : "",
            ].join(" ")}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".nes"
                className="hidden"
                onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                }}
            />
            <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3 text-left">
                    <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-(--panel-2) font-mono text-[10px] font-black text-(--accent)">
                        .NES
                    </span>
                    <div>
                        <div className="text-sm font-bold text-(--text)">
                            {dragging ? "Drop ROM" : "Add ROM"}
                        </div>
                        <div className="mt-0.5 text-xs text-(--muted)">.nes files only</div>
                    </div>
                </div>
                <span className="shrink-0 rounded-lg bg-(--accent) px-3 py-2 text-xs font-bold text-(--accent-text)">
                    Browse
                </span>
            </div>
        </div>
    );
}
