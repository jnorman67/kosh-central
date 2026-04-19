import type { AdminFolder, FolderInput } from '@/app/features/admin/models/folder.models';
import { AdminFoldersError } from '@/app/features/admin/services/admin-folders.service';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useState } from 'react';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    initial?: AdminFolder | null;
    onSubmit: (input: FolderInput) => Promise<void>;
}

const EMPTY: FolderInput = { slug: '', displayName: '', sharingUrl: '', folderPath: '', sortOrder: 0 };

export function FolderFormDialog({ open, onOpenChange, mode, initial, onSubmit }: Props) {
    const [form, setForm] = useState<FolderInput>(EMPTY);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Reset form state whenever the dialog is (re-)opened.
    useEffect(() => {
        if (!open) return;
        if (mode === 'edit' && initial) {
            setForm({
                slug: initial.slug,
                displayName: initial.displayName,
                sharingUrl: initial.sharingUrl,
                folderPath: initial.folderPath,
                sortOrder: initial.sortOrder,
            });
        } else {
            setForm(EMPTY);
        }
        setFieldErrors({});
        setFormError(null);
        setSaving(false);
    }, [open, mode, initial]);

    const handleChange = (key: keyof FolderInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = key === 'sortOrder' ? Number(e.target.value) || 0 : e.target.value;
        setForm((f) => ({ ...f, [key]: value }));
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const showFolderPathWarning =
        mode === 'edit' && !!initial && form.folderPath.trim() !== initial.folderPath && form.folderPath.trim().length > 0;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setFormError(null);
        setFieldErrors({});
        try {
            await onSubmit({
                slug: form.slug.trim(),
                displayName: form.displayName.trim(),
                sharingUrl: form.sharingUrl.trim(),
                folderPath: form.folderPath.trim(),
                sortOrder: form.sortOrder,
            });
            onOpenChange(false);
        } catch (err) {
            if (err instanceof AdminFoldersError) {
                if (err.field) {
                    setFieldErrors({ [err.field]: err.message });
                } else {
                    setFormError(err.message);
                }
            } else {
                setFormError(err instanceof Error ? err.message : String(err));
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'New folder' : 'Edit folder'}</DialogTitle>
                    <DialogDescription>The sharing URL will be validated against OneDrive before the folder is saved.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="slug">Slug</Label>
                        <Input
                            id="slug"
                            value={form.slug}
                            onChange={handleChange('slug')}
                            placeholder="album-21"
                            autoComplete="off"
                            required
                        />
                        <p className="text-xs text-muted-foreground">Lowercase letters, digits, and hyphens. Used in URLs.</p>
                        {fieldErrors.slug && <p className="text-xs text-destructive">{fieldErrors.slug}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="displayName">Display name</Label>
                        <Input id="displayName" value={form.displayName} onChange={handleChange('displayName')} required />
                        {fieldErrors.displayName && <p className="text-xs text-destructive">{fieldErrors.displayName}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="sharingUrl">OneDrive sharing URL</Label>
                        <Input
                            id="sharingUrl"
                            value={form.sharingUrl}
                            onChange={handleChange('sharingUrl')}
                            placeholder="https://1drv.ms/f/..."
                            required
                        />
                        {fieldErrors.sharingUrl && <p className="text-xs text-destructive">{fieldErrors.sharingUrl}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="folderPath">Folder path</Label>
                        <Input
                            id="folderPath"
                            value={form.folderPath}
                            onChange={handleChange('folderPath')}
                            placeholder="Dorothy's Albums/album21"
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            Path relative to the scan root, matching the folderName recorded by the scanner.
                        </p>
                        {fieldErrors.folderPath && <p className="text-xs text-destructive">{fieldErrors.folderPath}</p>}
                        {showFolderPathWarning && (
                            <p className="text-xs text-amber-600 dark:text-amber-500">
                                Changing folderPath will disconnect photos already cataloged under the previous path until the manifest is
                                re-imported.
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="sortOrder">Sort order</Label>
                        <Input id="sortOrder" type="number" value={form.sortOrder} onChange={handleChange('sortOrder')} />
                        <p className="text-xs text-muted-foreground">Lower numbers appear first.</p>
                    </div>

                    {formError && <p className="text-sm text-destructive">{formError}</p>}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Saving...' : mode === 'create' ? 'Create folder' : 'Save changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
