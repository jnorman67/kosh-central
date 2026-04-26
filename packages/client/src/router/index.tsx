import { AdminQueryProvider } from '@/app/features/admin/contexts/admin-query.context';
import { FoldersAdminPage } from '@/app/features/admin/pages/folders-admin-page';
import { AuthGuard } from '@/app/features/auth/components/auth-guard';
import { AdminGuard } from '@/app/features/auth/components/admin-guard';
import { ChangePasswordPage } from '@/app/features/auth/pages/change-password-page';
import { LoginPage } from '@/app/features/auth/pages/login-page';
import { RegisterPage } from '@/app/features/auth/pages/register-page';
import { CommentsQueryProvider } from '@/app/features/comments/contexts/comments-query.context';
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
                    <CommentsQueryProvider>
                        <ViewerPage />
                    </CommentsQueryProvider>
                </PhotosQueryProvider>
            </AuthGuard>
        ),
    },
    {
        path: '/account/password',
        element: (
            <AuthGuard>
                <ChangePasswordPage />
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
