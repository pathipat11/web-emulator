import SystemCard from "@/components/SystemCard";
import { AppShell } from "@/components/shell/AppShell";

export default function Home() {
    const systems = [
        { title: "Game Boy Advance", desc: "Portable 32-bit classics powered by mGBA WASM.", core: "mGBA", extension: ".gba", href: "/gba", disabled: false, image: "/images/gba.jpeg" },
        { title: "Nintendo NES", desc: "8-bit console games running through the JSNES core.", core: "JSNES", extension: ".nes", href: "/nes", disabled: false, image: "/images/nes.jpeg" },
        { title: "Nintendo DS", desc: "Dual-screen emulation powered by DeSmuME and EmulatorJS.", core: "DeSmuME", extension: ".nds", href: "/ds", disabled: false, image: "/images/ds.jpeg" },
        { title: "PlayStation Portable", desc: "PSP emulation with the PPSSPP core is planned for a future release.", core: "PPSSPP", extension: ".iso", href: "#", disabled: true, image: "/images/psp.jpg" },
        { title: "Super Nintendo", desc: "The 16-bit console library is planned for a future release.", core: "Planned", extension: ".sfc", href: "#", disabled: true, image: "/images/SNES.jpeg" },
        { title: "Game Boy", desc: "Original handheld system support is coming soon.", core: "Planned", extension: ".gb", href: "#", disabled: true, image: "/images/gb.jpeg" },
        { title: "PlayStation", desc: "Disc and BIOS-based emulation is under evaluation.", core: "Planned", extension: ".cue", href: "#", disabled: true, image: "/images/Ps1.jpeg" },
    ];

    return (
        <AppShell
            eyebrow="Main menu"
            title="Browse systems"
            status={(
                <span className="hidden items-center gap-2 rounded-full border border-(--success-border) bg-(--success-soft) px-3 py-1.5 text-xs font-bold text-(--success) sm:inline-flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    3 systems ready
                </span>
            )}
        >
            <section aria-labelledby="systems-heading">
                <div className="mb-4 flex items-end justify-between gap-4">
                    <div>
                        <h2 id="systems-heading" className="text-xl font-black tracking-tight">
                            Select a system
                        </h2>
                    </div>
                    <span className="text-xs font-semibold text-(--muted)">3 of 7 available</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {systems.map((system) => (
                        <SystemCard key={system.title} {...system} />
                    ))}
                </div>
            </section>

            <div className="mt-8 hidden items-center justify-between border-t border-(--border) pt-4 text-[11px] font-semibold text-(--muted) lg:flex">
                <span>Web Emulator Lab</span>
                <div className="flex items-center gap-4">
                    <span><kbd className="command-key">↵</kbd> Select</span>
                    <span><kbd className="command-key">Esc</kbd> Back</span>
                </div>
            </div>
        </AppShell>
    );
}
