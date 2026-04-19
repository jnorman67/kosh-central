import type { Photo } from '@/app/features/photos/models/photos.models';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

interface LetterboxViewerProps {
    photo: Photo | null;
    isLoading: boolean;
    /** If provided, the image becomes clickable (e.g. to cancel back-enlargement). */
    onClick?: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const DOUBLE_CLICK_SCALE = 2;

export function LetterboxViewer({ photo, isLoading, onClick }: LetterboxViewerProps) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

    const zoomable = !onClick;

    useEffect(() => {
        setImgLoaded(false);
        setScale(1);
        setOffset({ x: 0, y: 0 });
    }, [photo?.downloadUrl]);

    // Reset zoom when entering/leaving the enlarged-related mode.
    useEffect(() => {
        if (!zoomable) {
            setScale(1);
            setOffset({ x: 0, y: 0 });
        }
    }, [zoomable]);

    // Wheel zoom, centered on the cursor. Must be a non-passive listener so we
    // can preventDefault.
    useEffect(() => {
        if (!zoomable) return;
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
    }, [zoomable]);

    function handleDoubleClick(e: ReactMouseEvent) {
        if (!zoomable) return;
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
        if (!zoomable || scale === 1) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        setIsDragging(true);
    }

    function handlePointerMove(e: ReactPointerEvent) {
        const start = dragStart.current;
        if (!start) return;
        setOffset({ x: start.ox + (e.clientX - start.x), y: start.oy + (e.clientY - start.y) });
    }

    function handlePointerUp(e: ReactPointerEvent) {
        if (!dragStart.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        dragStart.current = null;
        setIsDragging(false);
    }

    const clickable = !!onClick;
    const showSpinner = isLoading || (!!photo && !imgLoaded);
    const zoomed = scale > 1;

    const cursorClass = clickable
        ? 'cursor-zoom-out'
        : zoomed
          ? isDragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
          : 'cursor-zoom-in';

    return (
        <div
            ref={containerRef}
            className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-black ${cursorClass}`}
            onClick={clickable ? onClick : undefined}
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
