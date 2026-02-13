import GbaPlayer from "@/components/GbaPlayer";

export default function GbaPage() {
    return (
        <main className="min-h-screen bg-(--bg)">
            <div className="mx-auto max-w-7xl">
                <GbaPlayer />
            </div>
        </main>
    );
}