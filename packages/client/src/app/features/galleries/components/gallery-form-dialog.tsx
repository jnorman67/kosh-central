import type { Gallery, GalleryInput, GalleryMatchMode } from '@/app/features/galleries/models/galleries.models';
import { PersonsPicker, type PickedPerson } from '@/app/features/photos/components/persons-picker';
import { SubjectsQueryProvider } from '@/app/features/photos/contexts/subjects-query.context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const NAME_MAX = 100;

const MATCH_MODES: { value: GalleryMatchMode; label: string; hint: string }[] = [
    { value: 'any', label: 'Any of them', hint: 'Every photo of any of these people.' },
    { value: 'all', label: 'All together', hint: 'Only photos with all of these people in them.' },
];

/** The name a gallery gets when the user leaves it blank, e.g. "Ann, Bob and Carol". */
export function defaultGalleryName(persons: PickedPerson[]): string {
    return new Intl.ListFormat('en', { type: 'conjunction' }).format(persons.map((p) => p.nickname || p.fullName)).slice(0, NAME_MAX);
}

interface GalleryFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The gallery being edited; omit to create one. */
    initial?: Gallery | null;
    onSubmit: (input: GalleryInput) => Promise<void>;
}

export function GalleryFormDialog({ open, onOpenChange, initial, onSubmit }: GalleryFormDialogProps) {
    const [name, setName] = useState('');
    const [persons, setPersons] = useState<PickedPerson[]>([]);
    const [matchMode, setMatchMode] = useState<GalleryMatchMode>('any');
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(initial?.name ?? '');
        setPersons(initial?.persons ?? []);
        setMatchMode(initial?.matchMode ?? 'any');
        setFormError(null);
        setSaving(false);
    }, [open, initial]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (persons.length === 0) {
            setFormError('Choose at least one person.');
            return;
        }
        setSaving(true);
        setFormError(null);
        try {
            // One person matches the same photos either way; store the simpler mode.
            await onSubmit({
                name: name.trim() || defaultGalleryName(persons),
                persons,
                matchMode: persons.length > 1 ? matchMode : 'any',
            });
            onOpenChange(false);
        } catch (err) {
            setFormError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{initial ? 'Edit gallery' : 'New gallery'}</DialogTitle>
                    <DialogDescription>
                        Gathers the photos tagged with these people from every album. Only you can see it.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>People</Label>
                        <SubjectsQueryProvider>
                            <PersonsPicker persons={persons} onChange={setPersons} />
                        </SubjectsQueryProvider>
                    </div>

                    {persons.length > 1 && (
                        <div className="space-y-1.5">
                            <Label>Show photos of</Label>
                            <div className="flex gap-2" role="radiogroup">
                                {MATCH_MODES.map((m) => (
                                    <Button
                                        key={m.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={matchMode === m.value}
                                        variant={matchMode === m.value ? 'secondary' : 'outline'}
                                        size="sm"
                                        className={cn(matchMode === m.value && 'ring-1 ring-ring')}
                                        onClick={() => setMatchMode(m.value)}
                                    >
                                        {m.label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">{MATCH_MODES.find((m) => m.value === matchMode)?.hint}</p>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="gallery-name">Name</Label>
                        <Input
                            id="gallery-name"
                            value={name}
                            maxLength={NAME_MAX}
                            placeholder={persons.length > 0 ? defaultGalleryName(persons) : 'e.g. Grandma and Grandpa'}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {formError && <p className="text-sm text-destructive">{formError}</p>}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving || persons.length === 0}>
                            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create gallery'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
