/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

type Props = {
    title: string;
    desc: string;
    href: string;
    disabled?: boolean;
    image?: string;
};

export default function SystemCard({ title, desc, href, disabled, image }: Props) {
    return (
        <div
            className={[
                "group overflow-hidden rounded-(--radius) border transition retro-noise",
                "bg-(--panel) border-(--border) shadow-(--shadow)",
                disabled ? "opacity-50" : "hover:shadow-(--shadow-2) hover:-translate-y-1",
            ].join(" ")}
        >
            {/* Image */}
            <div className="relative aspect-16/10 w-full overflow-hidden bg-(--panel-2)">
                {image ? (
                    <img
                        src={image}
                        alt={title}
                        className={[
                            "h-full w-full object-cover transition-transform duration-300",
                            disabled ? "" : "group-hover:scale-105",
                        ].join(" ")}
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-4xl text-(--muted)">
                        🎮
                    </div>
                )}

                {/* Status dot */}
                <div className="absolute right-3 top-3">
                    <div className={[
                        "h-2.5 w-2.5 rounded-full",
                        disabled ? "bg-(--muted)/40" : "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]",
                    ].join(" ")} />
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="text-base font-extrabold tracking-tight">{title}</div>
                <div className="mt-1 text-sm text-(--muted) leading-snug">{desc}</div>

                <div className="mt-3">
                    {disabled ? (
                        <button
                            className="rounded-xl border px-4 py-2 text-sm border-(--border) bg-transparent text-(--muted)"
                            disabled
                            type="button"
                        >
                            Coming soon
                        </button>
                    ) : (
                        <Link
                            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm border-(--border) bg-(--accent) text-white hover:brightness-110 active:translate-y-px transition"
                            href={href}
                        >
                            Open <span className="text-white/70">→</span>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
