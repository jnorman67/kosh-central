import { AdminQueryProvider } from '@/app/features/admin/contexts/admin-query.context';
import { FoldersAdminPage } from '@/app/features/admin/pages/folders-admin-page';
import { AdminGuard } from '@/app/features/auth/components/admin-guard';
import { AuthGuard } from '@/app/features/auth/components/auth-guard';
import { LoginPage } from '@/app/features/auth/pages/login-page';
import { RegisterPage } from '@/app/features/auth/pages/register-page';
import { PhotosQueryProvider } from '@/app/features/photos/contexts/photos-query.context';
import { FavoritesPage } from '@/app/features/photos/pages/favorites-page';
import { SlideshowPage } from '@/app/features/photos/pages/slideshow-page';
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
    {
        path: '/favorites',
        element: (
            <AuthGuard>
                <PhotosQueryProvider>
                    <FavoritesPage />
                </PhotosQueryProvider>
            </AuthGuard>
        ),
    },
    {
        path: '/slideshow',
        element: (
            <AuthGuard>
                <PhotosQueryProvider>
                    <SlideshowPage />
                </PhotosQueryProvider>
            </AuthGuard>
        ),
    },
    {
        path: '/admin/folders',
        element: (
            <AuthGuard>
                <AdminGuard>
                    <AdminQueryProvider>
                        <FoldersAdminPage />
                    </AdminQueryProvider>
                </AdminGuard>
            </AuthGuard>
        ),
    },
]);
