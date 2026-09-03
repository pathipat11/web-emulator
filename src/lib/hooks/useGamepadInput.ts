import { useEffect, useRef } from "react";
import type { EmulatorCore, GamepadMapping } from "@/lib/emulator-core";

/**
 * Generic gamepad input hook — works for any system.
 *
 * @param coreRef        ref to the emulator core
 * @param mapping        button/axis → emulator button mapping
 * @param setGamepadInfo callback to display controller info in UI
 */
export function useGamepadInput<B extends string>(
    coreRef: React.RefObject<EmulatorCore | null>,
    mapping: GamepadMapping<B>,
    setGamepadInfo: (s: string) => void,
    enabled = true,
) {
    const activeIndexRef = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const activeInputs = new Map<string, B>();
        let raf = 0;
        let lastInfo = "";

        const updateInfo = (info: string) => {
            if (lastInfo === info) return;
            lastInfo = info;
            setGamepadInfo(info);
        };

        const hasActiveButton = (button: B) =>
            Array.from(activeInputs.values()).some((activeButton) => activeButton === button);

        const setInput = (key: string, button: B, isDown: boolean) => {
            if (isDown) {
                if (activeInputs.has(key)) return;
                const buttonAlreadyActive = hasActiveButton(button);
                activeInputs.set(key, button);
                if (!buttonAlreadyActive) coreRef.current?.press(button);
                return;
            }

            const activeButton = activeInputs.get(key);
            if (!activeButton) return;
            activeInputs.delete(key);
            if (!hasActiveButton(activeButton)) coreRef.current?.release(activeButton);
        };

        const releaseAll = () => {
            const buttons = new Set(activeInputs.values());
            activeInputs.clear();
            const core = coreRef.current;
            if (!core) return;
            for (const button of buttons) core.release(button);
        };

        const onConnected = (e: GamepadEvent) => {
            if (activeIndexRef.current !== e.gamepad.index) releaseAll();
            activeIndexRef.current = e.gamepad.index;
            updateInfo(`${e.gamepad.id} (index ${e.gamepad.index})`);
        };
        const onDisconnected = (e: GamepadEvent) => {
            if (
                activeIndexRef.current !== null &&
                activeIndexRef.current !== e.gamepad.index
            ) return;
            releaseAll();
            activeIndexRef.current = null;
            updateInfo("No controller");
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") releaseAll();
        };

        window.addEventListener("gamepadconnected", onConnected);
        window.addEventListener("gamepaddisconnected", onDisconnected);
        window.addEventListener("blur", releaseAll);
        document.addEventListener("visibilitychange", onVisibilityChange);

        const tick = () => {
            const pads = navigator.getGamepads?.() ?? [];
            const gp =
                (activeIndexRef.current != null ? pads[activeIndexRef.current] : null) ||
                pads.find((p) => p && p.connected) ||
                null;

            if (gp) {
                if (activeIndexRef.current !== gp.index) {
                    releaseAll();
                    activeIndexRef.current = gp.index;
                }
                updateInfo(`${gp.id} (index ${gp.index})`);

                // buttons
                for (const [btnIndexStr, btn] of Object.entries(mapping.buttons)) {
                    if (!btn) continue;
                    const idx = Number(btnIndexStr);
                    const isDown = !!gp.buttons?.[idx]?.pressed;
                    setInput(`b:${idx}`, btn, isDown);
                }

                // axes
                const axes = mapping.axes;
                if (axes) {
                    const dz = axes.deadzone ?? 0.3;

                    const handleAxis = (name: "x" | "y") => {
                        const cfg = axes[name];
                        if (!cfg) return;
                        const v = gp.axes?.[cfg.index] ?? 0;

                        const negKey = `a:${name}:neg`;
                        const posKey = `a:${name}:pos`;

                        setInput(negKey, cfg.negative, v < -dz);
                        setInput(posKey, cfg.positive, v > dz);
                    };

                    handleAxis("x");
                    handleAxis("y");
                }
            } else {
                releaseAll();
                updateInfo("No controller");
            }

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("gamepadconnected", onConnected);
            window.removeEventListener("gamepaddisconnected", onDisconnected);
            window.removeEventListener("blur", releaseAll);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            releaseAll();
        };
    }, [coreRef, enabled, mapping, setGamepadInfo]);
}
