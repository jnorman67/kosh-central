import { AuthGuard } from '@/app/features/auth/components/auth-guard';
import { LoginPage } from '@/app/features/auth/pages/login-page';
import { RegisterPage } from '@/app/features/auth/pages/register-page';
import { PhotosQueryProvider } from '@/app/features/photos/contexts/photos-query.context';
import { ViewerPage } from '@/app/features/photos/pages/viewer-page';
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
    {
        path: '/login',
        element: <LoginPage />,
    },
    {
        path: '/register',
        element: <RegisterPage />,
    },
    {
        path: '/',
        element: (
            <AuthGuard>
                <PhotosQueryProvider>
                    <ViewerPage />
                </PhotosQueryProvider>
            </AuthGuard>
        ),
    },
]);
