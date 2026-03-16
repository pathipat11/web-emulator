import NesPlayer from "@/components/nes/NesPlayer";

export default function NesPage() {
    return (
        <main className="min-h-screen bg-(--bg)">
            <div className="mx-auto max-w-7xl">
                <NesPlayer />
            </div>
        </main>
    );
}
