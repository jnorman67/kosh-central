import type { Photo } from '@/app/features/photos/models/photos.models';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

interface LetterboxViewerProps {
    photo: Photo | null;
    isLoading: boolean;
    /** If provided, an un-dragged click at scale 1 fires this (e.g. to cancel back-enlargement). */
    onClick?: () => void;
    /** Called on a leftward horizontal swipe at scale 1. */
    onSwipeNext?: () => void;
    /** Called on a rightward horizontal swipe at scale 1. */
    onSwipePrev?: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const DOUBLE_CLICK_SCALE = 2;
const DRAG_THRESHOLD_PX = 3;
const SWIPE_THRESHOLD_PX = 50;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_RADIUS_PX = 30;

interface PointerPos {
    x: number;
    y: number;
}

interface SingleStart {
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
}

interface PinchStart {
    d: number;
    mx: number;
    my: number;
    scale: number;
    ox: number;
    oy: number;
}

export function LetterboxViewer({ photo, isLoading, onClick, onSwipeNext, onSwipePrev }: LetterboxViewerProps) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Refs mirror state so handlers read the freshest value without waiting for a re-render.
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });
    scaleRef.current = scale;
    offsetRef.current = offset;

    const pointers = useRef<Map<number, PointerPos>>(new Map());
    const singleStart = useRef<SingleStart | null>(null);
    const pinchStart = useRef<PinchStart | null>(null);
    const lastTap = useRef<{ t: number; x: number; y: number }>({ t: 0, x: 0, y: 0 });

    useEffect(() => {
        setImgLoaded(false);
        setScale(1);
        setOffset({ x: 0, y: 0 });
        pointers.current.clear();
        singleStart.current = null;
        pinchStart.current = null;
    }, [photo?.downloadUrl]);

    // Wheel zoom, centered on the cursor. Non-passive so we can preventDefault.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        function onWheel(e: WheelEvent) {
            e.preventDefault();
            const rect = el!.getBoundingClientRect();
            const cx = e.clientX - rect.left - rect.width / 2;
            const cy = e.clientY - rect.top - rect.height / 2;
            const factor = Math.exp(-e.deltaY * 0.002);

            setScale((s) => {
                const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor));
                if (next === s) return s;
                setOffset((o) => {
                    if (next === 1) return { x: 0, y: 0 };
                    const ratio = next / s;
                    return { x: cx - (cx - o.x) * ratio, y: cy - (cy - o.y) * ratio };
                });
                return next;
            });
        }

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    function applyTransform(newScale: number, newOffset: { x: number; y: number }) {
        scaleRef.current = newScale;
        offsetRef.current = newOffset;
        setScale(newScale);
        setOffset(newOffset);
    }

    function zoomAround(clientX: number, clientY: number) {
        const rect = containerRef.current!.getBoundingClientRect();
        const cx = clientX - rect.left - rect.width / 2;
        const cy = clientY - rect.top - rect.height / 2;
        if (scaleRef.current === 1) {
            applyTransform(DOUBLE_CLICK_SCALE, { x: cx - cx * DOUBLE_CLICK_SCALE, y: cy - cy * DOUBLE_CLICK_SCALE });
        } else {
            applyTransform(1, { x: 0, y: 0 });
        }
    }

    function pinchMetrics() {
        const pts = [...pointers.current.values()];
        const rect = containerRef.current!.getBoundingClientRect();
        const mx = (pts[0].x + pts[1].x) / 2 - rect.left - rect.width / 2;
        const my = (pts[0].y + pts[1].y) / 2 - rect.top - rect.height / 2;
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        return { d, mx, my };
    }

    function handlePointerDown(e: ReactPointerEvent) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        e.currentTarget.setPointerCapture(e.pointerId);

        if (pointers.current.size === 1) {
            singleStart.current = {
                x: e.clientX,
                y: e.clientY,
                ox: offsetRef.current.x,
                oy: offsetRef.current.y,
                moved: false,
            };
            setIsDragging(scaleRef.current > 1);
        } else if (pointers.current.size === 2) {
            const { d, mx, my } = pinchMetrics();
            pinchStart.current = { d, mx, my, scale: scaleRef.current, ox: offsetRef.current.x, oy: offsetRef.current.y };
            singleStart.current = null;
            setIsDragging(false);
        }
    }

    function handlePointerMove(e: ReactPointerEvent) {
        const pt = pointers.current.get(e.pointerId);
        if (!pt) return;
        pt.x = e.clientX;
        pt.y = e.clientY;

        if (pointers.current.size >= 2 && pinchStart.current) {
            const { d, mx, my } = pinchMetrics();
            const base = pinchStart.current;
            const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, base.scale * (d / base.d)));
            if (next === 1) {
                applyTransform(1, { x: 0, y: 0 });
            } else {
                const ratio = next / base.scale;
                applyTransform(next, {
                    x: mx - (base.mx - base.ox) * ratio,
                    y: my - (base.my - base.oy) * ratio,
                });
            }
        } else if (pointers.current.size === 1 && singleStart.current) {
            const start = singleStart.current;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
                start.moved = true;
            }
            if (scaleRef.current > 1) {
                applyTransform(scaleRef.current, { x: start.ox + dx, y: start.oy + dy });
            }
        }
    }

    function handlePointerUp(e: ReactPointerEvent) {
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // A pointer may have been canceled; ignore.
        }
        pointers.current.delete(e.pointerId);

        if (pointers.current.size === 0) {
            const start = singleStart.current;
            if (start) {
                const dx = e.clientX - start.x;
                const dy = e.clientY - start.y;
                if (scaleRef.current === 1 && start.moved) {
                    // Horizontal-dominant drag past threshold → swipe.
                    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
                        if (dx < 0) onSwipeNext?.();
                        else onSwipePrev?.();
                    }
                } else if (!start.moved && (scaleRef.current > 1 || !onClick)) {
                    // Custom double-click/tap detection for both mouse and touch. When zoomed in,
                    // always allow double-tap to reset. When at scale 1, skip if onClick is wired
                    // (tap-to-exit consumes the first tap instead).
                    const now = performance.now();
                    const d = Math.hypot(e.clientX - lastTap.current.x, e.clientY - lastTap.current.y);
                    if (now - lastTap.current.t < DOUBLE_TAP_MS && d < DOUBLE_TAP_RADIUS_PX) {
                        zoomAround(e.clientX, e.clientY);
                        lastTap.current = { t: 0, x: 0, y: 0 };
                    } else {
                        lastTap.current = { t: now, x: e.clientX, y: e.clientY };
                    }
                }
            }
            pinchStart.current = null;
            setIsDragging(false);
        } else if (pointers.current.size === 1) {
            // Pinch ended; switch the remaining finger into single-pointer tracking for pan.
            const remaining = [...pointers.current.values()][0];
            singleStart.current = {
                x: remaining.x,
                y: remaining.y,
                ox: offsetRef.current.x,
                oy: offsetRef.current.y,
                moved: false,
            };
            pinchStart.current = null;
            setIsDragging(scaleRef.current > 1);
        }
    }

    function handleClick() {
        if (!onClick) return;
        if (singleStart.current?.moved) return;
        if (scaleRef.current !== 1) return;
        onClick();
    }

    const showSpinner = isLoading || (!!photo && !imgLoaded);
    const zoomed = scale > 1;
    const exitable = !!onClick && scale === 1;

    const cursorClass = zoomed ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : exitable ? 'cursor-zoom-out' : 'cursor-default';

    return (
        <div
            ref={containerRef}
            className={`relative flex h-full w-full touch-none items-center justify-center overflow-hidden bg-black ${cursorClass}`}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {photo && (
                <img
                    src={photo.downloadUrl}
                    alt={photo.name}
                    onLoad={() => setImgLoaded(true)}
                    draggable={false}
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
                    className={`max-h-full max-w-full object-contain select-none transition-opacity duration-150 ${imgLoaded ? 'opacity-100' : 'opacity-40'}`}
                />
            )}
            {!photo && !isLoading && <div className="text-zinc-500">No photo selected</div>}
            {showSpinner && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200" />
                </div>
            )}
        </div>
    );
}
