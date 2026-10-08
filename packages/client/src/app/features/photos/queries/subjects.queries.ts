import { FeaturedQueryKeys } from '@/app/features/featured/queries/featured.queries';
import { GalleriesQueryKeys } from '@/app/features/galleries/queries/galleries.queries';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { SubjectsService } from '../services/subjects.service';

export const SubjectsQueryKeys = {
    forPhoto: (photoId: string) => ['Subjects', 'Photo', photoId] as const,
    suggestionsForPhoto: (photoId: string) => ['Subjects', 'Suggestions', photoId] as const,
    personSearch: (q: string) => ['Subjects', 'PersonSearch', q] as const,
} as const;

/** The featured album (its page and its gallery) and people galleries carry photos of chosen people,
 *  so a tag change can add or drop a photo there. Marked stale rather than refetched, so the gallery
 *  being tagged in doesn't reshuffle underfoot; the next visit picks up the change. */
const invalidateFeaturedPhotos = (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: FeaturedQueryKeys.featured, refetchType: 'none' });
    qc.invalidateQueries({ queryKey: ['Photos', 'Photos'], refetchType: 'none' });
    qc.invalidateQueries({ queryKey: GalleriesQueryKeys.all, refetchType: 'none' });
};

export const createSubjectsQueries = (service: SubjectsService) => {
    const usePhotoSubjects = (photoId: string | null) =>
        useQuery({
            queryKey: SubjectsQueryKeys.forPhoto(photoId!),
            queryFn: () => service.getPhotoSubjects(photoId!),
            enabled: !!photoId,
            staleTime: 30 * 1000,
        });

    const useSubjectSuggestions = (photoId: string | null) =>
        useQuery({
            queryKey: SubjectsQueryKeys.suggestionsForPhoto(photoId!),
            queryFn: () => service.getSubjectSuggestions(photoId!),
            enabled: !!photoId,
            staleTime: 30 * 1000,
        });

    const useSearchPersons = (q: string) =>
        useQuery({
            queryKey: SubjectsQueryKeys.personSearch(q),
            queryFn: () => service.searchPersons(q),
            enabled: q.trim().length > 0,
            staleTime: 60 * 1000,
        });

    const useAddSubject = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ personId, photoId }: { personId: string; photoId: string }) => service.addSubject(personId, photoId),
            onSuccess: (_, { photoId }) => {
                qc.invalidateQueries({ queryKey: SubjectsQueryKeys.forPhoto(photoId) });
                qc.invalidateQueries({ queryKey: SubjectsQueryKeys.suggestionsForPhoto(photoId) });
                invalidateFeaturedPhotos(qc);
            },
        });
    };

    const useRemoveSubject = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ personId, photoId }: { personId: string; photoId: string }) => service.removeSubject(personId, photoId),
            onSuccess: (_, { photoId }) => {
                qc.invalidateQueries({ queryKey: SubjectsQueryKeys.forPhoto(photoId) });
                invalidateFeaturedPhotos(qc);
            },
        });
    };

    const useSetPortrait = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ personId, photoId }: { personId: string; photoId: string | null }) =>
                service.setPortrait(personId, photoId),
            onSuccess: () => {
                // Invalidate the persons list so mention candidates pick up the new portrait
                qc.invalidateQueries({ queryKey: ['Persons', 'All'] });
            },
        });
    };

    return { usePhotoSubjects, useSubjectSuggestions, useSearchPersons, useAddSubject, useRemoveSubject, useSetPortrait };
};

export type SubjectsQueries = ReturnType<typeof createSubjectsQueries>;
