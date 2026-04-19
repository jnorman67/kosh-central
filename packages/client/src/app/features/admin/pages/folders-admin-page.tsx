import { FolderFormDialog } from '@/app/features/admin/components/folder-form-dialog';
import { ImportDialog } from '@/app/features/admin/components/import-dialog';
import { useAdminFoldersQueries, useAdminFoldersService } from '@/app/features/admin/contexts/admin-query.context';
import type { AdminFolder, FolderInput } from '@/app/features/admin/models/folder.models';
import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function FoldersAdminPage() {
    const navigate = useNavigate();
    const { useGetMe, useLogout } = useAuthQueries();
    const { data: me } = useGetMe();
    const logout = useLogout();
    const { useListFolders, useCreateFolder, useUpdateFolder, useDeleteFolder, useImportFolders } = useAdminFoldersQueries();
    const service = useAdminFoldersService();

    const { data: folders = [], isLoading, error } = useListFolders();
    const createFolder = useCreateFolder();
    const updateFolder = useUpdateFolder();
    const deleteFolder = useDeleteFolder();
    const importFolders = useImportFolders();

    const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
    const [editing, setEditing] = useState<AdminFolder | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [deleting, setDeleting] = useState<AdminFolder | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    function openCreate() {
        setEditing(null);
        setFormMode('create');
    }

    function openEdit(folder: AdminFolder) {
        setEditing(folder);
        setFormMode('edit');
    }

    async function handleSubmit(input: FolderInput) {
        if (formMode === 'edit' && editing) {
            await updateFolder.mutateAsync({ slug: editing.slug, input });
            setToast(`Updated "${input.displayName}"`);
        } else {
            await createFolder.mutateAsync(input);
            setToast(`Created "${input.displayName}"`);
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        const name = deleting.displayName;
        try {
            await deleteFolder.mutateAsync(deleting.slug);
            setToast(`Deleted "${name}"`);
        } finally {
            setDeleting(null);
        }
    }

    async function handleImport(input: FolderInput[], mode: 'upsert' | 'replace') {
        const result = await importFolders.mutateAsync({ folders: input, mode });
        setToast(
            mode === 'replace'
                ? `Replaced folders: ${result.created} total`
                : `Imported folders: ${result.created} created, ${result.updated} updated`,
        );
        return result;
    }

    function handleLogout() {
        logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
    }

    return (
        <ViewerLayout
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/')} title="Back to viewer">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-2 py-2 text-sm font-medium">Folder configuration</div>
                    </div>
                    <div className="flex items-center gap-3 px-4">
                        <span className="text-sm text-muted-foreground">{me?.displayName}</span>
                        <Button variant="ghost" size="sm" onClick={handleLogout}>
                            Sign out
                        </Button>
                    </div>
                </div>
            }
            viewer={
                <div className="h-full overflow-auto">
                    <div className="mx-auto w-full max-w-5xl space-y-4 p-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h1 className="text-xl font-semibold">Folders</h1>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" asChild>
                                    <a href={service.exportUrl()} download>
                                        <Download className="mr-2 h-4 w-4" />
                                        Export
                                    </a>
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import
                                </Button>
                                <Button size="sm" onClick={openCreate}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New folder
                                </Button>
                            </div>
                        </div>

                        {toast && (
                            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                                {toast}
                                <button className="ml-2 text-xs underline" onClick={() => setToast(null)}>
                                    dismiss
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                Failed to load folders: {error instanceof Error ? error.message : String(error)}
                            </div>
                        )}

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-20">Order</TableHead>
                                        <TableHead>Slug</TableHead>
                                        <TableHead>Display name</TableHead>
                                        <TableHead>Folder path</TableHead>
                                        <TableHead className="w-24 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                                Loading...
                                            </TableCell>
                                        </TableRow>
                                    ) : folders.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                                No folders configured yet.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        folders.map((folder) => (
                                            <TableRow key={folder.slug}>
                                                <TableCell className="text-muted-foreground">{folder.sortOrder}</TableCell>
                                                <TableCell className="font-mono text-xs">{folder.slug}</TableCell>
                                                <TableCell>{folder.displayName}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{folder.folderPath}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(folder)} title="Edit">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setDeleting(folder)}
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <FolderFormDialog
                            open={formMode !== null}
                            onOpenChange={(open) => !open && setFormMode(null)}
                            mode={formMode ?? 'create'}
                            initial={editing}
                            onSubmit={handleSubmit}
                        />

                        <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />

                        <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete folder?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {deleting ? (
                                            <>
                                                Remove the <span className="font-medium">{deleting.displayName}</span> folder from this
                                                configuration. Photos already cataloged under its folderPath remain in the database; you can
                                                re-add the folder later to surface them again.
                                            </>
                                        ) : null}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            }
        />
    );
}
