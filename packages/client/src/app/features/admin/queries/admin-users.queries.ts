import type { AdminUsersResponse, Role, UserUpdate } from '@/app/features/admin/models/user.models';
import type { AdminUsersService } from '@/app/features/admin/services/admin-users.service';
import { AuthQueryKeys } from '@/app/features/auth/queries/auth.queries';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const AdminUsersQueryKeys = {
    list: ['AdminUsers', 'List'] as const,
} as const;

export const createAdminUsersQueries = (service: AdminUsersService) => {
    const useListUsers = () =>
        useQuery({
            queryKey: AdminUsersQueryKeys.list,
            queryFn: () => service.list(),
            staleTime: 30 * 1000,
        });

    const useUpdateUser = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ id, update }: { id: string; update: UserUpdate }) => service.updateUser(id, update),
            onSuccess: (updated) => {
                qc.setQueryData<AdminUsersResponse>(
                    AdminUsersQueryKeys.list,
                    (old) => old && { ...old, users: old.users.map((u) => (u.id === updated.id ? updated : u)) },
                );
                qc.invalidateQueries({ queryKey: AdminUsersQueryKeys.list });
                // An admin may have edited their own name or email.
                qc.invalidateQueries({ queryKey: AuthQueryKeys.me });
            },
        });
    };

    const useCreateInvite = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ email, role }: { email: string; role: Role }) => service.createInvite(email, role),
            onSuccess: () => qc.invalidateQueries({ queryKey: AdminUsersQueryKeys.list }),
        });
    };

    const useUpdateInvite = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: ({ email, role }: { email: string; role: Role }) => service.updateInvite(email, role),
            onSuccess: () => qc.invalidateQueries({ queryKey: AdminUsersQueryKeys.list }),
        });
    };

    const useDeleteInvite = () => {
        const qc = useQueryClient();
        return useMutation({
            mutationFn: (email: string) => service.deleteInvite(email),
            onSuccess: () => qc.invalidateQueries({ queryKey: AdminUsersQueryKeys.list }),
        });
    };

    return { useListUsers, useUpdateUser, useCreateInvite, useUpdateInvite, useDeleteInvite };
};

export type AdminUsersQueries = ReturnType<typeof createAdminUsersQueries>;
