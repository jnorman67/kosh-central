import type { PersonInput } from '@/app/features/admin/models/person.models';
import type { AdminPersonsService } from '@/app/features/admin/services/admin-persons.service';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

export const AdminPersonsQueryKeys = {
    list: ['AdminPersons', 'List'] as const,
    relationships: (id: string) => ['AdminPersons', 'Relationships', id] as const,
} as const;

/** Approving, merging or rejecting a suggestion changes names and tags shown across the app. */
const invalidateAfterReview = (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: AdminPersonsQueryKeys.list });
    qc.invalidateQueries({ queryKey: ['Persons', 'All'] });
    qc.invalidateQueries({ queryKey: ['Subjects'] });
};

export const createAdminPersonsQueries = (service: AdminPersonsService) => {
    const useListPersons = () =>
        useQuery({
            queryKey: AdminPersonsQueryKeys.list,
            queryFn: () => service.list(),
            staleTime: 30 * 1000,
        });

    const useGetRelationships = (personId: string | null) =>
        useQuery({
            queryKey: AdminPersonsQueryKeys.relationships(personId ?? ''),
            queryFn: () => service.getRelationships(personId!),
            enabled: !!personId,
            staleTime: 30 * 1000,
        });

    const useCreatePerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (input: PersonInput) => service.create(input),
            onSuccess: () => qc.invalidateQueries({ queryKey: AdminPersonsQueryKeys.list }),
        });
    };

    const useUpdatePerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ id, input }: { id: string; input: PersonInput }) => service.update(id, input),
            onSuccess: () => qc.invalidateQueries({ queryKey: AdminPersonsQueryKeys.list }),
        });
    };

    const useDeletePerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (id: string) => service.remove(id),
            onSuccess: () => qc.invalidateQueries({ queryKey: AdminPersonsQueryKeys.list }),
        });
    };

    const useApprovePerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (id: string) => service.approve(id),
            onSuccess: () => invalidateAfterReview(qc),
        });
    };

    const useMergePerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ id, intoPersonId }: { id: string; intoPersonId: string }) => service.merge(id, intoPersonId),
            onSuccess: () => invalidateAfterReview(qc),
        });
    };

    const useRejectPerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (id: string) => service.reject(id),
            onSuccess: () => invalidateAfterReview(qc),
        });
    };

    return {
        useListPersons,
        useGetRelationships,
        useCreatePerson,
        useUpdatePerson,
        useDeletePerson,
        useApprovePerson,
        useMergePerson,
        useRejectPerson,
    };
};

export type AdminPersonsQueries = ReturnType<typeof createAdminPersonsQueries>;
