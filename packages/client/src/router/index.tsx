import { AdminQueryProvider } from '@/app/features/admin/contexts/admin-query.context';
import { FeaturedAdminPage } from '@/app/features/admin/pages/featured-admin-page';
import { FoldersAdminPage } from '@/app/features/admin/pages/folders-admin-page';
import { PersonsAdminPage } from '@/app/features/admin/pages/persons-admin-page';
import { UserEditPage } from '@/app/features/admin/pages/user-edit-page';
import { UsersAdminPage } from '@/app/features/admin/pages/users-admin-page';
import { AdminGuard } from '@/app/features/auth/components/admin-guard';
import { AuthGuard } from '@/app/features/auth/components/auth-guard';
import { ChangePasswordPage } from '@/app/features/auth/pages/change-password-page';
import { LoginPage } from '@/app/features/auth/pages/login-page';
import { RegisterPage } from '@/app/features/auth/pages/register-page';
import { CommentsQueryProvider } from '@/app/features/comments/contexts/comments-query.context';
import { FeaturedPage } from '@/app/features/featured/pages/featured-page';
import { GalleriesQueryProvider } from '@/app/features/galleries/contexts/galleries-query.context';
import { PhotosQueryProvider } from '@/app/features/photos/contexts/photos-query.context';
import { SubjectsQueryProvider } from '@/app/features/photos/contexts/subjects-query.context';
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
                    <GalleriesQueryProvider>
                        <CommentsQueryProvider>
                            <ViewerPage />
                        </CommentsQueryProvider>
                    </GalleriesQueryProvider>
                </PhotosQueryProvider>
            </AuthGuard>
        ),
    },
    {
        path: '/featured',
        element: (
            <AuthGuard>
                <FeaturedPage />
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
    {
        path: '/admin/featured',
        element: (
            <AuthGuard>
                <AdminGuard>
                    <PhotosQueryProvider>
                        <SubjectsQueryProvider>
                            <FeaturedAdminPage />
                        </SubjectsQueryProvider>
                    </PhotosQueryProvider>
                </AdminGuard>
            </AuthGuard>
        ),
    },
    {
        path: '/admin/users',
        element: (
            <AuthGuard>
                <AdminGuard>
                    <AdminQueryProvider>
                        <UsersAdminPage />
                    </AdminQueryProvider>
                </AdminGuard>
            </AuthGuard>
        ),
    },
    {
        path: '/admin/users/:id',
        element: (
            <AuthGuard>
                <AdminGuard>
                    <AdminQueryProvider>
                        <UserEditPage />
                    </AdminQueryProvider>
                </AdminGuard>
            </AuthGuard>
        ),
    },
    {
        path: '/admin/persons',
        element: (
            <AuthGuard>
                <AdminGuard>
                    <AdminQueryProvider>
                        <PersonsAdminPage />
                    </AdminQueryProvider>
                </AdminGuard>
            </AuthGuard>
        ),
    },
    {
        path: '/persons',
        element: (
            <AuthGuard>
                <AdminQueryProvider>
                    <PersonsAdminPage />
                </AdminQueryProvider>
            </AuthGuard>
        ),
    },
]);
