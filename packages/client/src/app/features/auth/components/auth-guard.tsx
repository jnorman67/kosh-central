import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { Navigate } from 'react-router-dom';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { useGetMe } = useAuthQueries();
    const { data: user, isLoading, isError } = useGetMe();

    // Render nothing while auth resolves — the static splash in index.html stays on top until
    // a leaf page calls hideSplash() once its initial data is ready.
    if (isLoading) return null;

    if (isError || !user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
