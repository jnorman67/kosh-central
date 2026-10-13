import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { loginPathFor } from '@/app/features/auth/lib/return-to';
import { Navigate, useLocation } from 'react-router-dom';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { useGetMe } = useAuthQueries();
    const { data: user, isLoading, isError } = useGetMe();
    const location = useLocation();

    // Render nothing while auth resolves — the static splash in index.html stays on top until
    // a leaf page calls hideSplash() once its initial data is ready.
    if (isLoading) return null;

    if (isError || !user) {
        return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
    }

    return <>{children}</>;
}
