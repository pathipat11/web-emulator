import SystemCard from "@/components/SystemCard";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  const systems = [
    { title: "GBA", desc: "Game Boy Advance (ROM: .gba) — เล่นในเบราว์เซอร์", href: "/gba", disabled: false },
    { title: "NES", desc: "Nintendo Entertainment System", href: "#", disabled: true },
    { title: "SNES", desc: "Super Nintendo", href: "#", disabled: true },
    { title: "GB", desc: "Game Boy", href: "#", disabled: true },
    { title: "PS1", desc: "PlayStation 1 (อาจต้อง BIOS)", href: "#", disabled: true },
  ];

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Web Emulator Lab</h1>
            <p className="mt-2 text-(--muted)">
              เลือกระบบที่ต้องการจำลอง แล้วอัปโหลด ROM ของคุณเองเพื่อเล่นในเว็บ
            </p>
          </div>

          <ThemeToggle />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((s) => (
            <SystemCard key={s.title} {...s} />
          ))}
        </div>
      </div>
    </main>
  );
}