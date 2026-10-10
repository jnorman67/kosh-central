import type { AdminPerson } from '@/app/features/admin/models/person.models';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface Props {
    /** The suggested person being folded into someone already in the index; null closes the dialog. */
    source: AdminPerson | null;
    persons: AdminPerson[];
    onOpenChange: (open: boolean) => void;
    onMerge: (intoPersonId: string) => Promise<void>;
}

export function MergePersonDialog({ source, persons, onOpenChange, onMerge }: Props) {
    const [search, setSearch] = useState('');
    const [targetId, setTargetId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!source) return;
        setSearch(source.fullName);
        setTargetId(null);
        setError(null);
        setSaving(false);
    }, [source]);

    const candidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        const words = q.split(/\s+/).filter(Boolean);
        return persons.filter(
            (p) =>
                !p.proposed &&
                p.id !== source?.id &&
                words.every((w) => p.fullName.toLowerCase().includes(w) || (p.nickname?.toLowerCase().includes(w) ?? false)),
        );
    }, [persons, search, source]);

    const target = targetId ? persons.find((p) => p.id === targetId) : undefined;

    async function handleMerge() {
        if (!targetId) return;
        setSaving(true);
        setError(null);
        try {
            await onMerge(targetId);
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setSaving(false);
        }
    }

    return (
        <Dialog open={source !== null} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Merge into an existing person</DialogTitle>
                    <DialogDescription>
                        Photo tags and comment mentions of <span className="font-medium">{source?.fullName}</span> will move to the person
                        you choose, and the suggestion will be removed.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search the index…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 pl-7 text-sm"
                        autoFocus
                    />
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border">
                    {candidates.length === 0 ? (
                        <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matches.</p>
                    ) : (
                        candidates.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setTargetId(p.id)}
                                className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted ${
                                    targetId === p.id ? 'bg-muted font-medium' : ''
                                }`}
                            >
                                <span>{p.fullName}</span>
                                {p.nickname && <span className="text-xs text-muted-foreground">"{p.nickname}"</span>}
                                {p.birthYear && <span className="text-xs text-muted-foreground">b. {p.birthYear}</span>}
                            </button>
                        ))
                    )}
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleMerge} disabled={!target || saving}>
                        {target ? `Merge into ${target.fullName}` : 'Merge'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
