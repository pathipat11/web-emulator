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

async function hashRom(bytes: Uint8Array): Promise<string> {
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const digest = await crypto.subtle.digest("SHA-256", ab);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 16);
}

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
                    className="rounded-(--radius) border bg-(--accent) px-4 py-2 text-sm font-medium text-white border-transparent"
                    role="status"
                >
                    {toast}
                </div>
            )}

            {list.length === 0 ? (
                <div className="py-8 text-center text-sm text-(--muted)">
                    No ROMs in library yet. Drop a .gba file above to get started.
                </div>
            ) : (
                <div className="space-y-2">
                    {list.map((entry) => (
                        <div
                            key={entry.romHash}
                            className="flex items-center gap-3 rounded-(--radius) border bg-(--panel) border-(--border) p-3 transition hover:shadow-(--shadow)"
                        >
                            {/* Cover / placeholder */}
                            {entry.coverDataUrl ? (
                                <img
                                    src={entry.coverDataUrl}
                                    alt={entry.name}
                                    className="h-12 w-16 rounded object-cover pixel-perfect"
                                />
                            ) : (
                                <div className="grid h-12 w-16 place-items-center rounded bg-(--panel-2) text-lg">
                                    🎮
                                </div>
                            )}

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-(--text)">
                                    {entry.name}
                                </div>
                                <div className="text-xs text-(--muted)">
                                    {fmtSize(entry.size)} · Added {fmtDate(entry.addedAt)}
                                    {entry.lastPlayedAt
                                        ? ` · Played ${fmtDate(entry.lastPlayedAt)}`
                                        : ""}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePlay(entry)}
                                    className="rounded-xl border px-3 py-1.5 text-xs font-medium text-white transition active:translate-y-px bg-(--accent) border-(--border) hover:brightness-105"
                                    type="button"
                                >
                                    Play
                                </button>
                                <button
                                    onClick={() => setDeleteTarget(entry)}
                                    className="rounded-xl border px-3 py-1.5 text-xs transition active:translate-y-px border-(--border) text-(--muted) hover:text-red-500"
                                    type="button"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
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
