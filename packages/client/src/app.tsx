import { AuthQueryProvider } from '@/app/features/auth/contexts/auth-query.context';
import { router } from '@/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

const queryClient = new QueryClient();

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthQueryProvider>
                <RouterProvider router={router} />
            </AuthQueryProvider>
        </QueryClientProvider>
    );
}
