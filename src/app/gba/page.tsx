import GbaPlayer from "@/components/gba/GbaPlayer";
import { TurboToastProvider } from "@/components/gba/TurboToastProvider";

export default function GbaPage() {
    return (
        <main className="min-h-screen bg-(--bg)">
            <div className="mx-auto max-w-7xl">
                <TurboToastProvider>
                    <GbaPlayer />
                </TurboToastProvider>
            </div>
        </main>
    );
}