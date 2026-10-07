import { viewerLocation } from '@/app/features/photos/lib/places';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/** Returns to the album, gallery or photo the user last had open in the viewer. */
export function useBackToViewer() {
    const navigate = useNavigate();
    return useCallback(() => navigate(viewerLocation()), [navigate]);
}
