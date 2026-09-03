"use client";

import { useModalDialog } from "@/lib/hooks/useModalDialog";
import { useGamepadMenuNavigation } from "@/lib/hooks/useGamepadMenuNavigation";

type EmulatorStatus = "idle" | "running" | "paused";
type SaveSlot = 1 | 2 | 3;

function MenuButton({
    label,
    detail,
    onClick,
    disabled,
    danger,
    primary,
}: {
    label: string;
    detail?: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
    primary?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            data-autofocus={primary ? "" : undefined}
            className={[
                "flex min-h-13 w-full items-center justify-between gap-4 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
                primary
                    ? "border-transparent bg-(--accent) text-(--accent-text)"
                    : danger
                        ? "border-(--border) bg-(--panel-2) text-(--danger) hover:border-(--danger)"
                        : "border-transparent bg-transparent text-(--text) hover:bg-(--panel-2)",
            ].join(" ")}
        >
            <span className="block text-sm font-bold">{label}</span>
            {detail && (
                <span className={["block text-right text-[11px]", primary ? "opacity-75" : "text-(--muted)"].join(" ")}>
                    {detail}
                </span>
            )}
        </button>
    );
}

export function EmulatorQuickMenu({
    open,
    systemLabel,
    status,
    romName,
    slot,
    audioEnabled,
    onClose,
    onToggleRun,
    onSave,
    onLoad,
    onReset,
    onScreenshot,
    onFullscreen,
    onToggleAudio,
    onOpenSettings,
    onEject,
}: {
    open: boolean;
    systemLabel: string;
    status: EmulatorStatus;
    romName: string;
    slot: SaveSlot;
    audioEnabled: boolean;
    onClose: () => void;
    onToggleRun: () => void;
    onSave: () => void;
    onLoad: () => void;
    onReset: () => void;
    onScreenshot: () => void;
    onFullscreen: () => void;
    onToggleAudio: () => void;
    onOpenSettings: () => void;
    onEject: () => void;
}) {
    const dialogRef = useModalDialog<HTMLElement>(open, onClose);
    useGamepadMenuNavigation(open, dialogRef, onClose);

    if (!open) return null;

    const hasRom = status !== "idle";

    return (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
            <button
                type="button"
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close quick menu"
            />

            <section
                ref={dialogRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="gba-quick-menu-title"
                className="relative z-10 w-full max-w-md rounded-2xl border border-(--border) bg-(--panel) p-4 shadow-(--shadow-2) sm:p-5"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-(--accent)">
                            {systemLabel}
                        </div>
                        <h2 id="gba-quick-menu-title" className="mt-1 text-xl font-black">
                            Quick Menu
                        </h2>
                        <p className="mt-1 truncate text-xs text-(--muted)">
                            {hasRom ? romName : "No ROM loaded"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-(--border) text-(--muted) transition hover:bg-(--panel-2) hover:text-(--text)"
                        aria-label="Close quick menu"
                    >
                        <span aria-hidden="true">✕</span>
                    </button>
                </div>

                <div className="mt-5 space-y-1">
                    <MenuButton
                        label={status === "running" ? "Pause" : "Resume"}
                        detail={status === "running" ? "Suspend gameplay" : "Continue gameplay"}
                        onClick={onToggleRun}
                        disabled={!hasRom}
                        primary
                    />
                    <MenuButton
                        label={`Save Slot ${slot}`}
                        detail="Create save state"
                        onClick={onSave}
                        disabled={!hasRom}
                    />
                    <MenuButton
                        label={`Load Slot ${slot}`}
                        detail="Restore save state"
                        onClick={onLoad}
                        disabled={!hasRom}
                    />
                    <MenuButton label="Reset" detail="Restart current ROM" onClick={onReset} disabled={!hasRom} />
                    <MenuButton label="Screenshot" detail="Save current frame" onClick={onScreenshot} disabled={!hasRom} />
                    <MenuButton label="Fullscreen" detail="Expand game screen" onClick={onFullscreen} disabled={!hasRom} />
                    <MenuButton
                        label={audioEnabled ? "Audio On" : "Audio Off"}
                        detail="Toggle emulator audio"
                        onClick={onToggleAudio}
                    />
                    <MenuButton label="Settings" detail="Saves, turbo and controls" onClick={onOpenSettings} />
                    <MenuButton label="Eject ROM" detail="Return to empty player" onClick={onEject} disabled={!hasRom} danger />
                </div>
            </section>
        </div>
    );
}
