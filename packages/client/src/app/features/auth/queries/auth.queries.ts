import type { AuthService } from '@/app/features/auth/services/auth.service';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const AuthQueryKeys = {
    me: ['Auth', 'Me'] as const,
} as const;

export const createAuthQueries = (service: AuthService) => {
    const useGetMe = () => {
        return useQuery({
            queryKey: AuthQueryKeys.me,
            queryFn: () => service.getMe(),
            retry: false,
            staleTime: 5 * 60 * 1000,
        });
    };

    const useLogin = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: ({ email, password }: { email: string; password: string }) => service.login(email, password),
            onSuccess: (user) => {
                queryClient.setQueryData(AuthQueryKeys.me, user);
            },
        });
    };

    const useRegister = () => {
        return useMutation({
            mutationFn: ({ email, displayName, password }: { email: string; displayName: string; password: string }) =>
                service.register(email, displayName, password),
        });
    };

    const useLogout = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: () => service.logout(),
            onSuccess: () => {
                queryClient.setQueryData(AuthQueryKeys.me, null);
                queryClient.invalidateQueries({ queryKey: AuthQueryKeys.me });
            },
        });
    };

    const useChangePassword = () => {
        return useMutation({
            mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
                service.changePassword(currentPassword, newPassword),
        });
    };

    return { useGetMe, useLogin, useRegister, useLogout, useChangePassword };
};

export type AuthQueries = ReturnType<typeof createAuthQueries>;
