import { FeaturedDisplay } from '@/app/features/featured/components/featured-display';
import { useFeaturedQueries } from '@/app/features/featured/contexts/featured-query.context';
import { DEFAULT_BUTTON_LABEL, FEATURED_THEME_ORDER, FEATURED_THEMES } from '@/app/features/featured/lib/featured-themes';
import type { FeaturedAlbumConfig, FeaturedAlbumConfigInput } from '@/app/features/featured/models/featured.models';
import { usePhotosQueries } from '@/app/features/photos/contexts/photos-query.context';
import { UserMenu } from '@/components/layout/user-menu';
import { ViewerLayout } from '@/components/layout/viewer-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api-client';
import { hideSplash } from '@/lib/splash';
import { cn } from '@/lib/utils';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function toInput({ updatedAt: _updatedAt, ...rest }: FeaturedAlbumConfig): FeaturedAlbumConfigInput {
    return rest;
}

const TEXTAREA_CLASSES =
    'flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function FeaturedAdminPage() {
    const navigate = useNavigate();
    const { useGetConfig, useUpdateConfig } = useFeaturedQueries();
    const { useGetFolders, useGetPhotos } = usePhotosQueries();
    const { data: config } = useGetConfig();
    const updateConfig = useUpdateConfig();
    const { data: folders = [] } = useGetFolders();

    // Unsaved edits. Null means "no edits" — the form shows the saved config.
    const [draft, setDraft] = useState<FeaturedAlbumConfigInput | null>(null);
    const [savedNotice, setSavedNotice] = useState(false);
    const form = draft ?? (config ? toInput(config) : null);
    const isDirty = !!draft && !!config && JSON.stringify(draft) !== JSON.stringify(toInput(config));

    useEffect(() => hideSplash(), []);

    const { data: photosData, isLoading: photosLoading } = useGetPhotos(form?.folderSlug ?? null);
    // Same "one photo per bundle" rule the viewer's gallery uses.
    const viewablePhotos = useMemo(
        () => (photosData?.photos ?? []).filter((p) => !p.catalogId || !p.bundleId || (p.side === 'front' && !!p.isPreferred)),
        [photosData],
    );
    const folder = folders.find((f) => f.id === form?.folderSlug) ?? null;

    // Mirrors the server's choice: explicit pick, else the album cover, else the first photo.
    const chosenPhoto = viewablePhotos.find((p) => p.name === form?.photoFileName);
    const previewPhoto = chosenPhoto ?? viewablePhotos.find((p) => p.name === folder?.coverFileName) ?? viewablePhotos[0] ?? null;
    const pickMissing = !!form?.photoFileName && !photosLoading && !!photosData && !chosenPhoto;

    if (!form) return null;

    const theme = FEATURED_THEMES[form.theme];
    const examples = theme.examples;

    function update(patch: Partial<FeaturedAlbumConfigInput>) {
        setSavedNotice(false);
        setDraft({ ...form!, ...patch });
    }

    function handleSave() {
        if (!draft) return;
        updateConfig.mutate(draft, {
            onSuccess: () => {
                setDraft(null);
                setSavedNotice(true);
            },
        });
    }

    const saveError = updateConfig.error;
    const errorField = saveError instanceof ApiError ? saveError.field : undefined;

    return (
        <ViewerLayout
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Back to viewer">
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Back to viewer</TooltipContent>
                        </Tooltip>
                        <div className="px-2 py-2 text-sm font-medium">Featured album</div>
                    </div>
                    <div className="flex items-center gap-3 px-4">
                        <UserMenu />
                    </div>
                </div>
            }
            viewer={
                <div className="h-full overflow-auto">
                    <div className="mx-auto grid w-full max-w-6xl gap-8 p-6 lg:grid-cols-2">
                        <div className="space-y-6">
                            <div className="space-y-1">
                                <h1 className="text-xl font-semibold">Featured album</h1>
                                <p className="text-sm text-muted-foreground">
                                    Highlight one album with a photo and a message, shown to everyone right after they sign in — a memorial,
                                    a birthday, a newly scanned collection.
                                </p>
                            </div>

                            <label className="flex items-start gap-3 rounded-md border p-3">
                                <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 accent-primary"
                                    checked={form.enabled}
                                    onChange={(e) => update({ enabled: e.target.checked })}
                                />
                                <span className="space-y-0.5">
                                    <span className="block text-sm font-medium">Show after sign-in</span>
                                    <span className="block text-xs text-muted-foreground">
                                        Everyone lands on this page when they sign in, and can return to it from their menu.
                                    </span>
                                </span>
                            </label>

                            <div className="space-y-2">
                                <Label>Album</Label>
                                <Select
                                    value={form.folderSlug ?? undefined}
                                    onValueChange={(slug) => update({ folderSlug: slug, photoFileName: null })}
                                >
                                    <SelectTrigger className={cn(errorField === 'folderSlug' && 'border-destructive')}>
                                        <SelectValue placeholder="Choose an album…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {folders.map((f) => (
                                            <SelectItem key={f.id} value={f.id}>
                                                {f.displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {form.folderSlug && (
                                <div className="space-y-2">
                                    <Label>Featured photo</Label>
                                    {photosLoading ? (
                                        <p className="text-sm text-muted-foreground">Loading photos…</p>
                                    ) : (
                                        <div className="grid max-h-72 grid-cols-4 gap-2 overflow-auto rounded-md border p-2 sm:grid-cols-5">
                                            <button
                                                type="button"
                                                onClick={() => update({ photoFileName: null })}
                                                className={cn(
                                                    'flex aspect-square items-center justify-center rounded-sm border border-dashed p-1 text-center text-xs text-muted-foreground',
                                                    !form.photoFileName && 'ring-2 ring-primary ring-offset-1',
                                                )}
                                            >
                                                Album cover
                                            </button>
                                            {viewablePhotos.map((p) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => update({ photoFileName: p.name })}
                                                    title={p.name}
                                                    className={cn(
                                                        'aspect-square overflow-hidden rounded-sm bg-muted',
                                                        form.photoFileName === p.name && 'ring-2 ring-primary ring-offset-1',
                                                    )}
                                                >
                                                    <img
                                                        src={p.thumbnailUrl ?? p.downloadUrl}
                                                        alt={p.name}
                                                        loading="lazy"
                                                        className="h-full w-full object-cover"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {pickMissing && (
                                        <p className="text-xs text-amber-700">
                                            “{form.photoFileName}” is no longer in this album, so the album cover is shown instead.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Theme</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {FEATURED_THEME_ORDER.map((key) => {
                                        const t = FEATURED_THEMES[key];
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => update({ theme: key })}
                                                className={cn(
                                                    'flex items-center gap-3 rounded-md border p-2 text-left transition-colors hover:bg-accent',
                                                    form.theme === key && 'border-primary ring-1 ring-primary',
                                                )}
                                            >
                                                <span className={cn('h-10 w-10 shrink-0 rounded-sm ring-1 ring-black/10', t.swatch)} />
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-medium">{t.label}</span>
                                                    <span className="block text-xs text-muted-foreground">{t.description}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="featured-eyebrow">Heading</Label>
                                <Input
                                    id="featured-eyebrow"
                                    value={form.eyebrow}
                                    placeholder={examples.eyebrow}
                                    maxLength={200}
                                    onChange={(e) => update({ eyebrow: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">Small line above the title.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="featured-title">Title</Label>
                                <Input
                                    id="featured-title"
                                    value={form.title}
                                    placeholder={examples.title}
                                    maxLength={200}
                                    aria-invalid={errorField === 'title'}
                                    className={cn(errorField === 'title' && 'border-destructive')}
                                    onChange={(e) => update({ title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="featured-subtitle">Subtitle</Label>
                                <Input
                                    id="featured-subtitle"
                                    value={form.subtitle}
                                    placeholder={examples.subtitle}
                                    maxLength={200}
                                    onChange={(e) => update({ subtitle: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">Dates, a place, an occasion — any short line.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="featured-message">Message</Label>
                                <textarea
                                    id="featured-message"
                                    value={form.message}
                                    placeholder={examples.message}
                                    maxLength={5000}
                                    rows={5}
                                    className={TEXTAREA_CLASSES}
                                    onChange={(e) => update({ message: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="featured-button">Button label</Label>
                                <Input
                                    id="featured-button"
                                    value={form.buttonLabel}
                                    placeholder={`${DEFAULT_BUTTON_LABEL} (e.g. “${examples.buttonLabel}”)`}
                                    maxLength={200}
                                    onChange={(e) => update({ buttonLabel: e.target.value })}
                                />
                            </div>

                            {saveError && <p className="text-sm text-destructive">{saveError.message}</p>}
                            <div className="flex items-center gap-3">
                                <Button onClick={handleSave} disabled={!isDirty || updateConfig.isPending}>
                                    {updateConfig.isPending ? 'Saving…' : 'Save'}
                                </Button>
                                {isDirty && (
                                    <Button variant="ghost" onClick={() => setDraft(null)} disabled={updateConfig.isPending}>
                                        Discard changes
                                    </Button>
                                )}
                                {savedNotice && !isDirty && <span className="text-sm text-green-700">Saved.</span>}
                                {config?.enabled && !isDirty && (
                                    <Button variant="link" className="ml-auto" onClick={() => navigate('/featured')}>
                                        <ExternalLink className="h-4 w-4" />
                                        View live page
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="lg:sticky lg:top-6 lg:self-start">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
                            <div className="overflow-hidden rounded-lg border shadow-sm">
                                <FeaturedDisplay
                                    content={form}
                                    imageUrl={previewPhoto ? (previewPhoto.thumbnailUrl ?? previewPhoto.downloadUrl) : null}
                                    imageAlt={previewPhoto?.name ?? ''}
                                    compact
                                />
                            </div>
                        </div>
                    </div>
                </div>
            }
        />
    );
}
