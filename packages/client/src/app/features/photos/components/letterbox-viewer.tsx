import type { Photo } from '@/app/features/photos/models/photos.models';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

interface LetterboxViewerProps {
    photo: Photo | null;
    isLoading: boolean;
    /** If provided, an un-dragged click at scale 1 fires this (e.g. to cancel back-enlargement). */
    onClick?: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const DOUBLE_CLICK_SCALE = 2;
const DRAG_THRESHOLD_PX = 3;

export function LetterboxViewer({ photo, isLoading, onClick }: LetterboxViewerProps) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
    const movedRef = useRef(false);

    useEffect(() => {
        setImgLoaded(false);
        setScale(1);
        setOffset({ x: 0, y: 0 });
    }, [photo?.downloadUrl]);

    // Wheel zoom, centered on the cursor. Must be a non-passive listener so we
    // can preventDefault.
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

    function handleDoubleClick(e: ReactMouseEvent) {
        const rect = containerRef.current!.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;

        if (scale === 1) {
            setScale(DOUBLE_CLICK_SCALE);
            setOffset({ x: cx - cx * DOUBLE_CLICK_SCALE, y: cy - cy * DOUBLE_CLICK_SCALE });
        } else {
            setScale(1);
            setOffset({ x: 0, y: 0 });
        }
    }

    function handlePointerDown(e: ReactPointerEvent) {
        movedRef.current = false;
        if (scale === 1) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        setIsDragging(true);
    }

    function handlePointerMove(e: ReactPointerEvent) {
        const start = dragStart.current;
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) movedRef.current = true;
        setOffset({ x: start.ox + dx, y: start.oy + dy });
    }

    function handlePointerUp(e: ReactPointerEvent) {
        if (!dragStart.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        dragStart.current = null;
        setIsDragging(false);
    }

    // Only treat a click as an exit gesture when we're at 1× and the pointer
    // didn't drag — otherwise it conflicts with pan-tap and double-click.
    function handleClick() {
        if (!onClick) return;
        if (movedRef.current) return;
        if (scale !== 1) return;
        onClick();
    }

    const showSpinner = isLoading || (!!photo && !imgLoaded);
    const zoomed = scale > 1;
    const exitable = !!onClick && scale === 1;

    const cursorClass = zoomed ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : exitable ? 'cursor-zoom-out' : 'cursor-zoom-in';

    return (
        <div
            ref={containerRef}
            className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-black ${cursorClass}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
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
