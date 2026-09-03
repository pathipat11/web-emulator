import GbaPlayer from "@/components/gba/GbaPlayer";
import { TurboToastProvider } from "@/components/gba/TurboToastProvider";

export default function GbaPage() {
    return (
        <main className="min-h-screen bg-(--bg)">
            <TurboToastProvider>
                <GbaPlayer />
            </TurboToastProvider>
        </main>
    );
}
