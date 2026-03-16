import SystemCard from "@/components/SystemCard";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  const systems = [
    { title: "GBA", desc: "Game Boy Advance — Play .gba ROMs in browser", href: "/gba", disabled: false, image: "/images/gba.jpeg" },
    { title: "NES", desc: "Nintendo Entertainment System — Play .nes ROMs in browser", href: "/nes", disabled: false, image: "/images/nes.jpeg" },
    { title: "SNES", desc: "Super Nintendo Entertainment System", href: "#", disabled: true, image: "/images/SNES.jpeg" },
    { title: "GB", desc: "Game Boy", href: "#", disabled: true, image: "/images/gb.jpeg" },
    { title: "PS1", desc: "PlayStation 1 (may require BIOS)", href: "#", disabled: true, image: "/images/Ps1.jpeg" },
  ];

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-12">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Web Emulator Lab
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-(--muted)">
              Choose a system to emulate, then upload your own ROM to play in the browser.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* System grid */}
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((s) => (
            <SystemCard key={s.title} {...s} />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-xs text-(--muted)">
          All ROMs are loaded client-side. Nothing is uploaded to any server.
        </div>
      </div>
    </main>
  );
}
