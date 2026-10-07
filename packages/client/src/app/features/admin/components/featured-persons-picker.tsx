import type { FeaturedPerson } from '@/app/features/featured/models/featured.models';
import { useSubjectsQueries } from '@/app/features/photos/contexts/subjects-query.context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { useState } from 'react';

interface FeaturedPersonsPickerProps {
    persons: FeaturedPerson[];
    onChange: (persons: FeaturedPerson[]) => void;
}

/** Search-and-add list of the people whose tagged photos follow the featured album. */
export function FeaturedPersonsPicker({ persons, onChange }: FeaturedPersonsPickerProps) {
    const { useSearchPersons } = useSubjectsQueries();
    const [query, setQuery] = useState('');
    const { data: results = [] } = useSearchPersons(query);

    const selectedIds = new Set(persons.map((p) => p.id));
    const matches = results.filter((p) => !selectedIds.has(p.id));

    function add(person: FeaturedPerson) {
        onChange([...persons, { id: person.id, fullName: person.fullName, nickname: person.nickname }]);
        setQuery('');
    }

    return (
        <div className="space-y-2">
            {persons.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                    {persons.map((p) => (
                        <li key={p.id} className="flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-3 pr-1 text-sm">
                            {p.fullName}
                            {p.nickname && <span className="text-muted-foreground">({p.nickname})</span>}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 rounded-full p-0"
                                onClick={() => onChange(persons.filter((x) => x.id !== p.id))}
                                aria-label={`Remove ${p.fullName}`}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="relative">
                <Input
                    placeholder="Add a person…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                />
                {query.trim() && matches.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-background shadow-md">
                        {matches.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent"
                                onClick={() => add(p)}
                            >
                                {p.fullName}
                                {p.nickname && <span className="ml-1 text-muted-foreground">({p.nickname})</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
