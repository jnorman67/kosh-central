import type { AdminPerson, PersonInput } from '@/app/features/admin/models/person.models';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';
import { useEffect, useState } from 'react';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    initial?: AdminPerson | null;
    onSubmit: (input: PersonInput) => Promise<void>;
}

const EMPTY: PersonInput = {
    fullName: '',
    nickname: null,
    sex: null,
    birthDate: null,
    birthPlace: null,
    deathDate: null,
    deathPlace: null,
    notes: null,
};

function extractYear(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const m = dateStr.match(/\b(\d{4})\b/);
    return m ? parseInt(m[1], 10) : null;
}

export function PersonFormDialog({ open, onOpenChange, mode, initial, onSubmit }: Props) {
    const [form, setForm] = useState<PersonInput>(EMPTY);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        if (mode === 'edit' && initial) {
            setForm({
                fullName: initial.fullName,
                nickname: initial.nickname,
                sex: initial.sex,
                birthDate: initial.birthDate,
                birthPlace: initial.birthPlace,
                deathDate: initial.deathDate,
                deathPlace: initial.deathPlace,
                notes: initial.notes,
            });
        } else {
            setForm(EMPTY);
        }
        setFormError(null);
        setSaving(false);
    }, [open, mode, initial]);

    function set<K extends keyof PersonInput>(key: K, value: PersonInput[K]) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setFormError(null);
        try {
            const birthYear = extractYear(form.birthDate);
            await onSubmit({ ...form, birthYear });
            onOpenChange(false);
        } catch (err) {
            setFormError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    }

    const field = (label: string, id: keyof PersonInput, required = false) => (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                value={(form[id] as string) ?? ''}
                onChange={(e) => set(id, e.target.value || null)}
                required={required}
            />
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'New person' : 'Edit person'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    {field('Full name', 'fullName', true)}
                    {field('Nickname', 'nickname')}

                    <div className="space-y-1.5">
                        <Label htmlFor="sex">Sex</Label>
                        <select
                            id="sex"
                            value={form.sex ?? ''}
                            onChange={(e) => set('sex', (e.target.value as 'M' | 'F' | 'U') || null)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="">—</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                            <option value="U">Other</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {field('Birth date', 'birthDate')}
                        {field('Birth place', 'birthPlace')}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {field('Death date', 'deathDate')}
                        {field('Death place', 'deathPlace')}
                    </div>
                    <p className="text-xs text-muted-foreground">Dates can be full (25 JUN 1940), partial (JUN 1940), or year-only (1940).</p>

                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Notes</Label>
                        <textarea
                            id="notes"
                            value={form.notes ?? ''}
                            onChange={(e) => set('notes', e.target.value || null)}
                            rows={3}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>

                    {formError && <p className="text-sm text-destructive">{formError}</p>}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
