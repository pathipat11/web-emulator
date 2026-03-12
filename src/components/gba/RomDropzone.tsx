"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
    /** Called after a valid .gba file is selected/dropped */
    onFile: (file: File) => void;
};

export function RomDropzone({ onFile }: Props) {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);

    const handleFiles = useCallback(
        (files: FileList | null) => {
            if (!files?.length) return;
            const file = files[0];
            if (!file.name.toLowerCase().endsWith(".gba")) return;
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
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            className={[
                "cursor-pointer rounded-(--radius) border-2 border-dashed p-8 text-center transition",
                "bg-(--panel) border-(--border) hover:border-(--accent)",
                dragging ? "border-(--accent) bg-(--panel-2) scale-[1.01]" : "",
            ].join(" ")}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".gba"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
            />

            <div className="text-3xl">🎮</div>
            <div className="mt-2 text-sm font-medium text-(--text)">
                {dragging ? "Drop ROM here" : "Drag & drop .gba ROM or click to browse"}
            </div>
            <div className="mt-1 text-xs text-(--muted)">Only .gba files are accepted</div>
        </div>
    );
}
