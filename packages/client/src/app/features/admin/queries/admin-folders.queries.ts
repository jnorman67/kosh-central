import type { FolderInput } from '@/app/features/admin/models/folder.models';
import type { AdminFoldersService } from '@/app/features/admin/services/admin-folders.service';
import { PhotosQueryKeys } from '@/app/features/photos/queries/photos.queries';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

export const AdminFoldersQueryKeys = {
    list: ['AdminFolders', 'List'] as const,
} as const;

// Folder edits affect both the admin list (this feature) and the viewer's
// album list (photos feature), so every mutation invalidates both keys —
// otherwise returning to the viewer shows a stale cached list.
function invalidateFolderCaches(qc: QueryClient) {
    qc.invalidateQueries({ queryKey: AdminFoldersQueryKeys.list });
    qc.invalidateQueries({ queryKey: PhotosQueryKeys.folders });
}

export const createAdminFoldersQueries = (service: AdminFoldersService) => {
    const useListFolders = () => {
        return useQuery({
            queryKey: AdminFoldersQueryKeys.list,
            queryFn: () => service.list(),
            staleTime: 30 * 1000,
        });
    };

    const useCreateFolder = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: (input: FolderInput) => service.create(input),
            onSuccess: () => invalidateFolderCaches(queryClient),
        });
    };

    const useUpdateFolder = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: ({ slug, input }: { slug: string; input: FolderInput }) => service.update(slug, input),
            onSuccess: () => invalidateFolderCaches(queryClient),
        });
    };

    const useDeleteFolder = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: (slug: string) => service.remove(slug),
            onSuccess: () => invalidateFolderCaches(queryClient),
        });
    };

    const useImportFolders = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: ({ folders, mode }: { folders: FolderInput[]; mode: 'upsert' | 'replace' }) => service.importFolders(folders, mode),
            onSuccess: () => invalidateFolderCaches(queryClient),
        });
    };

    const useReorderFolders = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: (slugs: string[]) => service.reorder(slugs),
            onSuccess: () => invalidateFolderCaches(queryClient),
        });
    };

    return { useListFolders, useCreateFolder, useUpdateFolder, useDeleteFolder, useImportFolders, useReorderFolders };
};

export type AdminFoldersQueries = ReturnType<typeof createAdminFoldersQueries>;
