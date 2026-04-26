import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Flag, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSubjectsQueries } from '../contexts/subjects-query.context';

interface SubjectsPanelProps {
    photoId: string;
    isAdmin: boolean;
    onDisputeSubject: (personId: string, personName: string) => void;
    className?: string;
}

export function SubjectsPanel({ photoId, isAdmin, onDisputeSubject, className }: SubjectsPanelProps) {
    const { usePhotoSubjects, useSubjectSuggestions, useSearchPersons, useAddSubject, useRemoveSubject } = useSubjectsQueries();

    const { data: subjects = [] } = usePhotoSubjects(photoId);
    const { data: suggestions = [] } = useSubjectSuggestions(isAdmin ? photoId : null);
    const addSubject = useAddSubject();
    const removeSubject = useRemoveSubject();

    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const { data: searchResults = [] } = useSearchPersons(searchQuery);
    const confirmedIds = new Set(subjects.map((s) => s.personId));
    const filteredResults = searchResults.filter((p) => !confirmedIds.has(p.id));

    function openSearch() {
        setShowSearch(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    }

    function closeSearch() {
        setShowSearch(false);
        setSearchQuery('');
    }

    function handleAddPerson(personId: string) {
        addSubject.mutate({ personId, photoId });
        closeSearch();
    }

    if (subjects.length === 0 && suggestions.length === 0 && !isAdmin) return null;

    return (
        <div className={`border-b border-amber-200 ${className ?? ''}`}>
            <div className="flex items-center justify-between px-4 py-2">
                <h3 className="text-sm font-semibold text-amber-900">
                    People {subjects.length > 0 && <span className="font-normal text-muted-foreground">({subjects.length})</span>}
                </h3>
                {isAdmin && !showSearch && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={openSearch}
                        aria-label="Tag a person"
                        title="Tag a person"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>

            {isAdmin && showSearch && (
                <div className="relative px-4 pb-2">
                    <Input
                        ref={inputRef}
                        placeholder="Search people…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
                        onBlur={(e) => {
                            if (!e.currentTarget.closest('[data-search-panel]')?.contains(e.relatedTarget)) {
                                closeSearch();
                            }
                        }}
                        className="h-7 text-sm"
                    />
                    {filteredResults.length > 0 && searchQuery.length > 0 && (
                        <div data-search-panel className="absolute z-10 mt-1 w-[calc(100%-2rem)] rounded-md border bg-background shadow-md">
                            {filteredResults.map((person) => (
                                <button
                                    key={person.id}
                                    type="button"
                                    className="flex w-full items-center px-3 py-1.5 text-sm hover:bg-accent"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleAddPerson(person.id)}
                                >
                                    {person.fullName}
                                    {person.nickname && <span className="ml-1 text-muted-foreground">({person.nickname})</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {subjects.length > 0 && (
                <div className="flex flex-col gap-0.5 px-4 pb-2">
                    {subjects.map((subject) => (
                        <div
                            key={subject.personId}
                            className="flex items-center justify-between gap-1 rounded px-1 py-0.5 hover:bg-amber-50"
                        >
                            <span className="min-w-0 truncate text-sm text-amber-900">
                                {subject.fullName}
                                {subject.nickname && <span className="ml-1 text-xs text-muted-foreground">({subject.nickname})</span>}
                            </span>
                            <div className="flex shrink-0 items-center gap-0.5">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-amber-700"
                                    onClick={() => onDisputeSubject(subject.personId, subject.fullName)}
                                    aria-label={`Dispute: ${subject.fullName}`}
                                    title="Dispute this identification"
                                >
                                    <Flag className="h-3 w-3" />
                                </Button>
                                {isAdmin && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeSubject.mutate({ personId: subject.personId, photoId })}
                                        aria-label={`Remove ${subject.fullName}`}
                                        title="Remove this identification"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {subjects.length === 0 && !showSearch && (
                <p className="px-4 pb-3 text-xs text-muted-foreground">{isAdmin ? 'No people tagged yet.' : 'No people identified.'}</p>
            )}

            {isAdmin && suggestions.length > 0 && (
                <div className="border-t border-amber-100 px-4 pb-3 pt-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Suggested from comments</p>
                    {suggestions.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-1 rounded px-1 py-0.5 hover:bg-amber-50">
                            <span className="min-w-0 truncate text-sm text-amber-900">
                                {s.fullName}
                                {s.nickname && <span className="ml-1 text-xs text-muted-foreground">({s.nickname})</span>}
                                <span className="ml-1 text-xs text-muted-foreground">×{s.mentionCount}</span>
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-green-700"
                                onClick={() => addSubject.mutate({ personId: s.id, photoId })}
                                aria-label={`Accept suggestion: ${s.fullName}`}
                                title="Accept this suggestion"
                            >
                                <Check className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
