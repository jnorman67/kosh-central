import { createBrowserRouter } from 'react-router-dom';
import { ViewerPage } from '@/app/features/photos/pages/viewer-page';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <ViewerPage />,
    },
]);
