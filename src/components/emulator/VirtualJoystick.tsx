"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type JoystickDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

const DIRECTIONS: readonly JoystickDirection[] = [
    "UP",
    "DOWN",
    "LEFT",
    "RIGHT",
];

const KEY_DIRECTIONS: Partial<Record<string, JoystickDirection>> = {
    ArrowUp: "UP",
    ArrowDown: "DOWN",
    ArrowLeft: "LEFT",
    ArrowRight: "RIGHT",
};

export function getJoystickDirections(
    normalizedX: number,
    normalizedY: number,
    deadzone = 0.28,
) {
    const directions: JoystickDirection[] = [];
    if (normalizedX < -deadzone) directions.push("LEFT");
    if (normalizedX > deadzone) directions.push("RIGHT");
    if (normalizedY < -deadzone) directions.push("UP");
    if (normalizedY > deadzone) directions.push("DOWN");
    return directions;
}

export function VirtualJoystick({
    onPress,
    onRelease,
    disabled = false,
    className = "",
    haptic = false,
}: {
    onPress: (direction: JoystickDirection) => void;
    onRelease: (direction: JoystickDirection) => void;
    disabled?: boolean;
    className?: string;
    haptic?: boolean;
}) {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const activePointerRef = useRef<number | null>(null);
    const activeDirectionsRef = useRef(new Set<JoystickDirection>());
    const onPressRef = useRef(onPress);
    const onReleaseRef = useRef(onRelease);

    useEffect(() => {
        onPressRef.current = onPress;
        onReleaseRef.current = onRelease;
    }, [onPress, onRelease]);

    const releaseDirections = useCallback((resetVisual = true) => {
        for (const direction of activeDirectionsRef.current) {
            onReleaseRef.current(direction);
        }
        activeDirectionsRef.current.clear();
        if (resetVisual) {
            setDragging(false);
            setPosition({ x: 0, y: 0 });
        }
    }, []);

    useEffect(() => {
        return () => {
            for (const direction of activeDirectionsRef.current) {
                onReleaseRef.current(direction);
            }
            activeDirectionsRef.current.clear();
        };
    }, []);

    const updateJoystick = useCallback(
        (clientX: number, clientY: number, element: HTMLDivElement) => {
            const rect = element.getBoundingClientRect();
            const rawX = clientX - (rect.left + rect.width / 2);
            const rawY = clientY - (rect.top + rect.height / 2);
            const maxDistance = Math.max(
                1,
                Math.min(rect.width, rect.height) * 0.3,
            );
            const distance = Math.hypot(rawX, rawY);
            const scale = distance > maxDistance
                ? maxDistance / distance
                : 1;
            const x = rawX * scale;
            const y = rawY * scale;
            const nextDirections = new Set(
                getJoystickDirections(
                    x / maxDistance,
                    y / maxDistance,
                ),
            );

            for (const direction of activeDirectionsRef.current) {
                if (!nextDirections.has(direction)) {
                    onReleaseRef.current(direction);
                }
            }
            for (const direction of nextDirections) {
                if (!activeDirectionsRef.current.has(direction)) {
                    onPressRef.current(direction);
                }
            }

            activeDirectionsRef.current = nextDirections;
            setPosition({ x, y });
        },
        [],
    );

    const finishPointer = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (activePointerRef.current !== event.pointerId) return;
            activePointerRef.current = null;
            releaseDirections();
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        },
        [releaseDirections],
    );

    return (
        <div
            role="application"
            aria-label="Virtual joystick"
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            className={[
                "relative aspect-square touch-none select-none rounded-full border border-(--border) bg-(--panel-2)",
                disabled ? "opacity-40" : "",
                className,
            ].join(" ")}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
                if (disabled || activePointerRef.current !== null) return;
                event.preventDefault();
                activePointerRef.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(true);
                updateJoystick(
                    event.clientX,
                    event.clientY,
                    event.currentTarget,
                );
                if (haptic) navigator.vibrate?.(8);
            }}
            onPointerMove={(event) => {
                if (
                    disabled ||
                    activePointerRef.current !== event.pointerId ||
                    !event.currentTarget.hasPointerCapture(event.pointerId)
                ) return;
                event.preventDefault();
                updateJoystick(
                    event.clientX,
                    event.clientY,
                    event.currentTarget,
                );
            }}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
            onLostPointerCapture={(event) => {
                if (activePointerRef.current !== event.pointerId) return;
                activePointerRef.current = null;
                releaseDirections();
            }}
            onKeyDown={(event) => {
                if (disabled || event.repeat) return;
                const direction = KEY_DIRECTIONS[event.key];
                if (!direction || activeDirectionsRef.current.has(direction)) return;
                event.preventDefault();
                activeDirectionsRef.current.add(direction);
                onPressRef.current(direction);
            }}
            onKeyUp={(event) => {
                const direction = KEY_DIRECTIONS[event.key];
                if (!direction || !activeDirectionsRef.current.has(direction)) return;
                event.preventDefault();
                activeDirectionsRef.current.delete(direction);
                onReleaseRef.current(direction);
            }}
        >
            <div className="absolute inset-[12%] rounded-full border border-(--border) bg-(--panel-3)" />
            {DIRECTIONS.map((direction) => (
                <span
                    key={direction}
                    aria-hidden="true"
                    className={[
                        "absolute h-1.5 w-1.5 rounded-full bg-(--muted)",
                        direction === "UP"
                            ? "left-1/2 top-[8%] -translate-x-1/2"
                            : direction === "DOWN"
                                ? "bottom-[8%] left-1/2 -translate-x-1/2"
                                : direction === "LEFT"
                                    ? "left-[8%] top-1/2 -translate-y-1/2"
                                    : "right-[8%] top-1/2 -translate-y-1/2",
                    ].join(" ")}
                />
            ))}
            <div
                data-joystick-thumb
                aria-hidden="true"
                className={[
                    "absolute left-1/2 top-1/2 grid h-[42%] w-[42%] place-items-center rounded-full border border-(--accent-border) bg-(--accent) shadow-(--shadow-2)",
                    dragging ? "" : "transition-transform duration-100",
                ].join(" ")}
                style={{
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                }}
            >
                <span className="h-[34%] w-[34%] rounded-full bg-(--accent-text)/35" />
            </div>
        </div>
    );
}
