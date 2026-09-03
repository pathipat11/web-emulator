const COMPACT_PLAY_MEDIA_QUERY = "(max-width: 1023px)";

export function shouldAutoEnterPlayMode() {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia(COMPACT_PLAY_MEDIA_QUERY).matches
    );
}
