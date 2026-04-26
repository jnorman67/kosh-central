import type { PersonInput } from '@/app/features/admin/models/person.models';
import type { AdminPersonsService } from '@/app/features/admin/services/admin-persons.service';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const AdminPersonsQueryKeys = {
    list: ['AdminPersons', 'List'] as const,
    relationships: (id: string) => ['AdminPersons', 'Relationships', id] as const,
} as const;

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

    return { useListPersons, useGetRelationships, useCreatePerson, useUpdatePerson, useDeletePerson };
};

export type AdminPersonsQueries = ReturnType<typeof createAdminPersonsQueries>;
