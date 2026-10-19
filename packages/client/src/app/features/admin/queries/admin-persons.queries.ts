import type { PersonInput } from '@/app/features/admin/models/person.models';
import type { AdminPersonsService } from '@/app/features/admin/services/admin-persons.service';
import { FeaturedQueryKeys } from '@/app/features/featured/queries/featured.queries';
import { GalleriesQueryKeys } from '@/app/features/galleries/queries/galleries.queries';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

export const AdminPersonsQueryKeys = {
    list: ['AdminPersons', 'List'] as const,
    relationships: (id: string) => ['AdminPersons', 'Relationships', id] as const,
} as const;

/** Any change to a person (edit, delete, approve, merge, reject) changes names and tags shown across
 *  the app: the viewer's People panel, person search, mentions, galleries and the featured album. */
const invalidatePersons = (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: AdminPersonsQueryKeys.list });
    qc.invalidateQueries({ queryKey: ['Persons', 'All'] });
    qc.invalidateQueries({ queryKey: ['Subjects'] });
    qc.invalidateQueries({ queryKey: GalleriesQueryKeys.all });
    qc.invalidateQueries({ queryKey: FeaturedQueryKeys.all });
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
            onSuccess: () => invalidatePersons(qc),
        });
    };

    const useUpdatePerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ id, input }: { id: string; input: PersonInput }) => service.update(id, input),
            onSuccess: () => invalidatePersons(qc),
        });
    };

    const useDeletePerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (id: string) => service.remove(id),
            onSuccess: () => invalidatePersons(qc),
        });
    };

    const useApprovePerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (id: string) => service.approve(id),
            onSuccess: () => invalidatePersons(qc),
        });
    };

    const useMergePerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ id, intoPersonId }: { id: string; intoPersonId: string }) => service.merge(id, intoPersonId),
            onSuccess: () => invalidatePersons(qc),
        });
    };

    const useRejectPerson = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (id: string) => service.reject(id),
            onSuccess: () => invalidatePersons(qc),
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
