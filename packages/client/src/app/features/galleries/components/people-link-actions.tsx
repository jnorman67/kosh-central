import { GalleryFormDialog } from '@/app/features/galleries/components/gallery-form-dialog';
import { useGalleriesQueries } from '@/app/features/galleries/contexts/galleries-query.context';
import { useShareGalleryLink } from '@/app/features/galleries/hooks/use-share-gallery-link';
import type { GalleryInput } from '@/app/features/galleries/models/galleries.models';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BookmarkPlus, EllipsisVertical, Share2 } from 'lucide-react';
import { useState } from 'react';

interface PeopleLinkActionsProps {
    /** The people the link names who still exist, its match mode, and its title. */
    gallery: GalleryInput;
    /** Called with the new gallery once the link is saved, to switch to it. */
    onSaved: (galleryId: string) => void;
}

/** Save and share buttons for a gallery opened from a shared link rather than saved. Phones fold
 *  them into one menu, leaving the header room for the gallery's name. */
export function PeopleLinkActions({ gallery, onSaved }: PeopleLinkActionsProps) {
    const { useCreateGallery } = useGalleriesQueries();
    const createGallery = useCreateGallery();
    const [saving, setSaving] = useState(false);
    const { share, copied } = useShareGalleryLink();

    return (
        <>
            {copied && <span className="text-xs text-muted-foreground">Link copied</span>}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="sm:hidden" aria-label="Gallery options">
                        <EllipsisVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void share(gallery)}>
                        <Share2 />
                        Share link
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setSaving(true)}>
                        <BookmarkPlus />
                        Save to my galleries
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void share(gallery)}
                        aria-label="Share gallery link"
                        className="hidden sm:inline-flex"
                    >
                        <Share2 className="h-4 w-4" />
                        <span className="hidden md:inline">Share</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Copy a link that shows anyone signed in these people’s photos</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSaving(true)}
                        aria-label="Save to my galleries"
                        className="hidden sm:inline-flex"
                    >
                        <BookmarkPlus className="h-4 w-4" />
                        <span className="hidden md:inline">Save</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Save to my galleries</TooltipContent>
            </Tooltip>

            <GalleryFormDialog
                open={saving}
                onOpenChange={setSaving}
                defaults={gallery}
                onSubmit={async (input) => {
                    const saved = await createGallery.mutateAsync(input);
                    onSaved(saved.id);
                }}
            />
        </>
    );
}
