/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from "react";
import { NesRomDropzone } from "./NesRomDropzone";
import { ConfirmDialog } from "./ConfirmDialog";
import {
    type NesRomEntry,
    getNesRomList,
    upsertNesRomEntry,
    putNesRomBytes,
    deleteNesRom,
    touchNesLastPlayed,
} from "@/lib/storage/nesRomStore";

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
    onPlay: (romHash: string, name: string) => void;
};

export function NesRomLibrary({ onPlay }: Props) {
    const [list, setList] = useState<NesRomEntry[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<NesRomEntry | null>(null);

    const refresh = useCallback(() => setList(getNesRomList()), []);

    useEffect(() => { refresh(); }, [refresh]);

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
            await putNesRomBytes(romHash, bytes);
            upsertNesRomEntry({
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
            await deleteNesRom(romHash);
            refresh();
            setToast("ROM removed.");
        },
        [refresh],
    );

    const handlePlay = useCallback(
        (entry: NesRomEntry) => {
            touchNesLastPlayed(entry.romHash);
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
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });
    }

    return (
        <div className="space-y-4">
            <NesRomDropzone onFile={handleImport} />

            {toast && (
                <div className="rounded-(--radius) border bg-(--accent) px-4 py-2 text-sm font-medium text-white border-transparent" role="status">
                    {toast}
                </div>
            )}

            {list.length === 0 ? (
                <div className="py-8 text-center text-sm text-(--muted)">
                    No ROMs in library yet. Drop a .nes file above to get started.
                </div>
            ) : (
                <div className="space-y-2">
                    {list.map((entry) => (
                        <div key={entry.romHash} className="flex items-center gap-3 rounded-(--radius) border bg-(--panel) border-(--border) p-3 transition hover:shadow-(--shadow)">
                            {entry.coverDataUrl ? (
                                <img src={entry.coverDataUrl} alt={entry.name} className="h-12 w-16 rounded object-cover pixel-perfect" />
                            ) : (
                                <div className="grid h-12 w-16 place-items-center rounded bg-(--panel-2) text-lg">🎮</div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-(--text)">{entry.name}</div>
                                <div className="text-xs text-(--muted)">
                                    {fmtSize(entry.size)} · Added {fmtDate(entry.addedAt)}
                                    {entry.lastPlayedAt ? ` · Played ${fmtDate(entry.lastPlayedAt)}` : ""}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handlePlay(entry)} className="rounded-xl border px-3 py-1.5 text-xs font-medium text-white transition active:translate-y-px bg-(--accent) border-(--border) hover:brightness-105" type="button">Play</button>
                                <button onClick={() => setDeleteTarget(entry)} className="rounded-xl border px-3 py-1.5 text-xs transition active:translate-y-px border-(--border) text-(--muted) hover:text-red-500" type="button">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete ROM"
                message={`Permanently delete "${deleteTarget?.name ?? ""}" and its save data from the library?`}
                confirmLabel="Delete"
                danger
                onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.romHash); setDeleteTarget(null); }}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
