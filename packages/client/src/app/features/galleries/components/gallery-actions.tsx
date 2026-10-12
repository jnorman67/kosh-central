import { GalleryFormDialog } from '@/app/features/galleries/components/gallery-form-dialog';
import { useGalleriesQueries } from '@/app/features/galleries/contexts/galleries-query.context';
import type { Gallery } from '@/app/features/galleries/models/galleries.models';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EllipsisVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface GalleryActionsProps {
    gallery: Gallery;
    /** Called once the gallery is gone, to leave its now-empty view. */
    onDeleted: () => void;
}

/** Edit and delete buttons for the people gallery being viewed. Phones fold them into one menu,
 *  leaving the header room for the gallery's name. */
export function GalleryActions({ gallery, onDeleted }: GalleryActionsProps) {
    const { useUpdateGallery, useDeleteGallery } = useGalleriesQueries();
    const updateGallery = useUpdateGallery();
    const deleteGallery = useDeleteGallery();
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="sm:hidden" aria-label="Gallery options">
                        <EllipsisVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(true)}>
                        <Pencil />
                        Edit gallery
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setConfirmingDelete(true)} disabled={deleteGallery.isPending}>
                        <Trash2 />
                        Delete gallery
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(true)}
                        aria-label="Edit gallery"
                        className="hidden sm:inline-flex"
                    >
                        <Pencil className="h-4 w-4" />
                        <span className="hidden md:inline">Edit</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Change the people or name</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingDelete(true)}
                        disabled={deleteGallery.isPending}
                        aria-label="Delete gallery"
                        className="hidden sm:inline-flex"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden md:inline">Delete</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Delete gallery</TooltipContent>
            </Tooltip>

            <GalleryFormDialog
                open={editing}
                onOpenChange={setEditing}
                initial={gallery}
                onSubmit={async (input) => {
                    await updateGallery.mutateAsync({ id: gallery.id, input });
                }}
            />
            <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this gallery?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-medium">{gallery.name}</span> will be removed from your galleries. The photos stay in
                            their albums.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteGallery.mutate(gallery.id, { onSuccess: onDeleted })}>
                            Delete gallery
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
