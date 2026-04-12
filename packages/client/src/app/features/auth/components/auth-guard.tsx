import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { Navigate } from 'react-router-dom';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { useGetMe } = useAuthQueries();
    const { data: user, isLoading, isError } = useGetMe();

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        );
    }

    if (isError || !user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
