/** Visual treatment for the featured album page. Must match FEATURED_THEMES on the server. */
export type FeaturedTheme = 'classic' | 'memorial' | 'celebration' | 'vintage';

/** The admin-written text shown on the featured album page. */
export interface FeaturedContent {
    theme: FeaturedTheme;
    /** Small heading above the title, e.g. "In loving memory" or "Happy 90th birthday". */
    eyebrow: string;
    title: string;
    subtitle: string;
    message: string;
    /** Label for the "see more photos" button. Empty means the default label. */
    buttonLabel: string;
}

export interface FeaturedPhoto {
    name: string;
    imageUrl: string;
    thumbnailUrl?: string;
    /** Value for the viewer's ?photo= param. */
    photoKey: string;
}

/** What GET /api/featured returns to signed-in users. */
export type FeaturedAlbum =
    | { enabled: false }
    | (FeaturedContent & {
          enabled: true;
          folderId: string;
          folderDisplayName: string;
          photo: FeaturedPhoto | null;
      });

/** Admin view of the stored settings (GET/PUT /api/admin/featured). */
export interface FeaturedAlbumConfig extends FeaturedContent {
    enabled: boolean;
    folderSlug: string | null;
    /** Null means "use the album cover". */
    photoFileName: string | null;
    updatedAt: string;
}

export type FeaturedAlbumConfigInput = Omit<FeaturedAlbumConfig, 'updatedAt'>;
