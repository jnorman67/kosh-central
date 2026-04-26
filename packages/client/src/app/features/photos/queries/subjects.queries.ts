import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubjectsService } from '../services/subjects.service';

export const SubjectsQueryKeys = {
    forPhoto: (photoId: string) => ['Subjects', 'Photo', photoId] as const,
    suggestionsForPhoto: (photoId: string) => ['Subjects', 'Suggestions', photoId] as const,
    personSearch: (q: string) => ['Subjects', 'PersonSearch', q] as const,
} as const;

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
            },
        });
    };

    const useRemoveSubject = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ personId, photoId }: { personId: string; photoId: string }) => service.removeSubject(personId, photoId),
            onSuccess: (_, { photoId }) => {
                qc.invalidateQueries({ queryKey: SubjectsQueryKeys.forPhoto(photoId) });
            },
        });
    };

    return { usePhotoSubjects, useSubjectSuggestions, useSearchPersons, useAddSubject, useRemoveSubject };
};

export type SubjectsQueries = ReturnType<typeof createSubjectsQueries>;
