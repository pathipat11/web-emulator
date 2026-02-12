import Link from "next/link";

type Props = {
    title: string;
    desc: string;
    href: string;
    disabled?: boolean;
};

export default function SystemCard({ title, desc, href, disabled }: Props) {
    return (
        <div
            className={[
                "rounded-(--radius) border p-5 transition retro-noise",
                "bg-(--panel) border-(--border) shadow-(--shadow)",
                disabled ? "opacity-60" : "hover:shadow-(--shadow-2) hover:-translate-y-0.5",
            ].join(" ")}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-extrabold tracking-tight">{title}</div>
                <div className="h-2 w-2 rounded-full bg-(--accent)" />
            </div>

            <div className="mt-2 text-sm text-(--muted)">{desc}</div>

            <div className="mt-4">
                {disabled ? (
                    <button className="rounded-xl border px-4 py-2 text-sm border-(--border) bg-transparent text-(--muted)" disabled>
                        Coming soon
                    </button>
                ) : (
                    <Link
                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm border-(--border) bg-(--accent) text-white hover:brightness-105 active:translate-y-px transition"
                        href={href}
                    >
                        Open <span className="text-white/80">→</span>
                    </Link>
                )}
            </div>
        </div>
    );
}