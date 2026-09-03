/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

type Props = {
    title: string;
    desc: string;
    href: string;
    core: string;
    extension: string;
    disabled?: boolean;
    image?: string;
};

export default function SystemCard({
    title,
    desc,
    href,
    core,
    extension,
    disabled,
    image,
}: Props) {
    const content = (
        <>
            <div className="relative aspect-16/10 w-full overflow-hidden bg-(--panel-2)">
                {image ? (
                    <img
                        src={image}
                        alt=""
                        className={[
                            "h-full w-full object-cover transition duration-300",
                            disabled ? "grayscale" : "group-hover:scale-[1.03]",
                        ].join(" ")}
                    />
                ) : (
                    <div className="grid h-full place-items-center text-3xl font-black text-(--muted)">
                        {title}
                    </div>
                )}
                <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
                    <span className="rounded-md bg-(--image-label) px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-(--image-label-text) backdrop-blur">
                        {core}
                    </span>
                    <span
                        className={[
                            "rounded-full border px-2 py-1 text-[10px] font-bold backdrop-blur",
                            disabled
                                ? "border-(--border) bg-(--panel-translucent) text-(--muted)"
                                : "border-(--success-border) bg-(--success-soft) text-(--success)",
                        ].join(" ")}
                    >
                        {disabled ? "Coming soon" : "Ready"}
                    </span>
                </div>
            </div>

            <div className="flex min-h-35 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-black tracking-tight">{title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-(--muted)">{desc}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-(--panel-2) px-2 py-1 font-mono text-[10px] font-bold text-(--muted)">
                        {extension}
                    </span>
                </div>

                <div className="mt-auto flex items-center justify-between pt-4 text-xs font-bold">
                    <span className={disabled ? "text-(--muted)" : "text-(--accent)"}>
                        {disabled ? "Unavailable" : "Launch system"}
                    </span>
                    {!disabled && (
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 text-(--accent)" fill="none">
                            <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                    )}
                </div>
            </div>
        </>
    );

    return (
        <article className={[
            "group overflow-hidden rounded-(--radius) border bg-(--panel) transition",
            "border-(--border) shadow-(--shadow)",
            disabled
                ? "opacity-60"
                : "hover:-translate-y-0.5 hover:border-(--accent-border)",
        ].join(" ")}>
            {disabled ? (
                <div aria-disabled="true">{content}</div>
            ) : (
                <Link href={href} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)">
                    {content}
                </Link>
            )}
        </article>
    );
}
