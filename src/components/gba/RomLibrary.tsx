/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from "react";
import { RomDropzone } from "./RomDropzone";
import { ConfirmDialog } from "./ConfirmDialog";
import {
    type RomEntry,
    getRomList,
    upsertRomEntry,
    putRomBytes,
    deleteRom,
    touchLastPlayed,
} from "@/lib/storage/romStore";
import { hashRom } from "@/lib/hashRom";

type Props = {
    /** Called when user clicks "Play" on a ROM */
    onPlay: (romHash: string, name: string) => void;
};

export function RomLibrary({ onPlay }: Props) {
    const [list, setList] = useState<RomEntry[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<RomEntry | null>(null);

    const refresh = useCallback(() => setList(getRomList()), []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // toast auto-hide
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(t);
    }, [toast]);

    const handleImport = useCallback(
        async (file: File) => {
            const buf = await file.arrayBuffer();
            const bytes = new Uint8Array(buf);
            const romHash = await hashRom(bytes);

            await putRomBytes(romHash, bytes);
            upsertRomEntry({
                romHash,
                name: file.name,
                size: bytes.length,
                addedAt: Date.now(),
                lastPlayedAt: null,
            });

            refresh();
            setToast(`Added: ${file.name}`);
        },
        [refresh],
    );

    const handleDelete = useCallback(
        async (romHash: string) => {
            await deleteRom(romHash);
            refresh();
            setToast("ROM removed.");
        },
        [refresh],
    );

    const handlePlay = useCallback(
        (entry: RomEntry) => {
            touchLastPlayed(entry.romHash);
            refresh();
            onPlay(entry.romHash, entry.name);
        },
        [onPlay, refresh],
    );

    function fmtSize(n: number) {
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }

    function fmtDate(ts: number | null) {
        if (!ts) return "—";
        return new Date(ts).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    return (
        <div className="space-y-4">
            <RomDropzone onFile={handleImport} />

            {toast && (
                <div
                    className="rounded-(--radius) border border-transparent bg-(--accent) px-4 py-2 text-sm font-medium text-(--accent-text)"
                    role="status"
                >
                    {toast}
                </div>
            )}

            {list.length === 0 ? (
                <div className="rounded-(--radius) border border-(--border) bg-(--panel) py-12 text-center">
                    <div className="text-sm font-bold text-(--text)">Library is empty</div>
                    <div className="mt-1 text-xs text-(--muted)">Add a .gba ROM above</div>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((entry) => (
                        <article
                            key={entry.romHash}
                            className="group overflow-hidden rounded-(--radius) border border-(--border) bg-(--panel) transition hover:border-(--accent-border)"
                        >
                            <div className="aspect-3/2 overflow-hidden bg-(--panel-2)">
                                {entry.coverDataUrl ? (
                                    <img
                                        src={entry.coverDataUrl}
                                        alt=""
                                        className="h-full w-full object-cover pixel-perfect transition duration-300 group-hover:scale-[1.02]"
                                    />
                                ) : (
                                    <div className="grid h-full place-items-center">
                                        <span className="rounded-lg border border-(--border) px-3 py-2 font-mono text-xs font-black text-(--muted)">
                                            GBA
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex min-h-35 flex-col p-4">
                                <div className="truncate text-sm font-bold text-(--text)" title={entry.name}>
                                    {entry.name}
                                </div>
                                <div className="mt-1 text-[11px] text-(--muted)">
                                    {fmtSize(entry.size)} · Added {fmtDate(entry.addedAt)}
                                </div>
                                {entry.lastPlayedAt && (
                                    <div className="mt-1 text-[11px] text-(--muted)">
                                        Played {fmtDate(entry.lastPlayedAt)}
                                    </div>
                                )}

                                <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                                    <button
                                        onClick={() => handlePlay(entry)}
                                        className="rounded-xl bg-(--accent) px-3 py-2 text-xs font-bold text-(--accent-text) transition hover:brightness-105"
                                        type="button"
                                    >
                                        Play
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(entry)}
                                        className="rounded-xl border border-(--border) px-3 py-2 text-xs font-bold text-(--muted) transition hover:border-(--danger) hover:text-(--danger)"
                                        type="button"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* Delete confirm */}
            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete ROM"
                message={`Permanently delete "${deleteTarget?.name ?? ""}" and its save data from the library?`}
                confirmLabel="Delete"
                danger
                onConfirm={() => {
                    if (deleteTarget) handleDelete(deleteTarget.romHash);
                    setDeleteTarget(null);
                }}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
