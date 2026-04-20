import { AuthQueryProvider } from '@/app/features/auth/contexts/auth-query.context';
import { AuthQueryKeys } from '@/app/features/auth/queries/auth.queries';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api-client';
import { router } from '@/router';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

/** On any 401 from the API (expired/invalid session), clear cached auth state and bounce the
 *  user to /login so stale UI doesn't linger — notably after `npm run dev` restarts the server
 *  and invalidates JWTs. Login-page 401s (bad credentials) also fire here; redirecting /login →
 *  /login is a no-op and the mutation's error still reaches the page for inline display. */
function handleAuthError(error: unknown) {
    if (!(error instanceof ApiError) || error.status !== 401) return;
    queryClient.setQueryData(AuthQueryKeys.me, null);
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        router.navigate('/login', { replace: true });
    }
}

const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleAuthError }),
    mutationCache: new MutationCache({ onError: handleAuthError }),
});

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthQueryProvider>
                <TooltipProvider delayDuration={300}>
                    <RouterProvider router={router} />
                </TooltipProvider>
            </AuthQueryProvider>
        </QueryClientProvider>
    );
}
