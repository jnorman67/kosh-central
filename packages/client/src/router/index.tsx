import { PhotosQueryProvider } from '@/app/features/photos/contexts/photos-query.context';
import { ViewerPage } from '@/app/features/photos/pages/viewer-page';
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
    {
        path: '/',
        element: (
            <PhotosQueryProvider>
                <ViewerPage />
            </PhotosQueryProvider>
        ),
    },
]);
