import { useEffect, useRef } from "react";
import { defaultDsGamepadMapping } from "@/lib/ds/gamepad";
import type { DsCore } from "@/lib/ds/core-adapter";

export function useDsGamepadInput(
    coreRef: React.RefObject<DsCore | null>,
    setGamepadInfo: (s: string) => void,
) {
    const activeIndexRef = useRef<number | null>(null);

    useEffect(() => {
        const onConnected = (e: GamepadEvent) => {
            activeIndexRef.current = e.gamepad.index;
            setGamepadInfo(`${e.gamepad.id} (index ${e.gamepad.index})`);
        };
        const onDisconnected = () => {
            activeIndexRef.current = null;
            setGamepadInfo("No controller");
        };

        window.addEventListener("gamepadconnected", onConnected);
        window.addEventListener("gamepaddisconnected", onDisconnected);

        let raf = 0;
        const pressed = new Set<string>();

        const tick = () => {
            const pads = navigator.getGamepads?.() ?? [];
            const gp =
                (activeIndexRef.current != null ? pads[activeIndexRef.current] : null) ||
                pads.find((p) => p && p.connected) ||
                null;

            if (gp) {
                setGamepadInfo(`${gp.id} (index ${gp.index})`);

                for (const [btnIndexStr, dsBtn] of Object.entries(defaultDsGamepadMapping.buttons)) {
                    const idx = Number(btnIndexStr);
                    const isDown = !!gp.buttons?.[idx]?.pressed;
                    const key = `b:${idx}`;

                    if (isDown && !pressed.has(key)) {
                        pressed.add(key);
                        coreRef.current?.press(dsBtn!);
                    } else if (!isDown && pressed.has(key)) {
                        pressed.delete(key);
                        coreRef.current?.release(dsBtn!);
                    }
                }

                const axes = defaultDsGamepadMapping.axes;
                if (axes) {
                    const dz = axes.deadzone ?? 0.3;

                    const handleAxis = (name: "x" | "y") => {
                        const cfg = axes[name];
                        if (!cfg) return;
                        const v = gp.axes?.[cfg.index] ?? 0;

                        const negKey = `a:${name}:neg`;
                        const posKey = `a:${name}:pos`;

                        if (v < -dz) {
                            if (!pressed.has(negKey)) { pressed.add(negKey); coreRef.current?.press(cfg.negative); }
                        } else if (pressed.has(negKey)) { pressed.delete(negKey); coreRef.current?.release(cfg.negative); }

                        if (v > dz) {
                            if (!pressed.has(posKey)) { pressed.add(posKey); coreRef.current?.press(cfg.positive); }
                        } else if (pressed.has(posKey)) { pressed.delete(posKey); coreRef.current?.release(cfg.positive); }
                    };

                    handleAxis("x");
                    handleAxis("y");
                }
            } else {
                setGamepadInfo("No controller");
                pressed.clear();
            }

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("gamepadconnected", onConnected);
            window.removeEventListener("gamepaddisconnected", onDisconnected);
        };
    }, [coreRef, setGamepadInfo]);
}
