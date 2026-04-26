import { PersonFormDialog } from '@/app/features/admin/components/person-form-dialog';
import { useAdminPersonsQueries } from '@/app/features/admin/contexts/admin-query.context';
import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import type { AdminPerson, PersonInput, PersonRelationship } from '@/app/features/admin/models/person.models';
import { UserMenu } from '@/components/layout/user-menu';
import { ViewerLayout } from '@/components/layout/viewer-layout';
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
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { hideSplash } from '@/lib/splash';
import { ArrowLeft, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SEX_LABEL: Record<string, string> = { M: 'Male', F: 'Female', U: 'Other' };

const REL_GROUP_LABEL: Record<string, string> = {
    'spouse-of': 'Spouses',
    'parent-of': 'Children',
    'sibling-of': 'Siblings',
    'friend-of': 'Friends',
};

function lifespan(person: AdminPerson): string {
    const birth = person.birthYear ?? person.birthDate?.match(/\b\d{4}\b/)?.[0] ?? null;
    const death = person.deathDate?.match(/\b\d{4}\b/)?.[0] ?? null;
    if (!birth && !death) return '';
    if (death) return `${birth ?? '?'} – ${death}`;
    return `b. ${birth}`;
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function PersonDetail({
    person,
    relationships,
    personIndex,
    isAdmin,
    onEdit,
    onDelete,
    onSelectPerson,
}: {
    person: AdminPerson;
    relationships: PersonRelationship[];
    personIndex: Map<string, AdminPerson>;
    isAdmin: boolean;
    onEdit: (p: AdminPerson) => void;
    onDelete: (p: AdminPerson) => void;
    onSelectPerson: (id: string) => void;
}) {
    const grouped = useMemo(() => {
        const map = new Map<string, PersonRelationship[]>();
        for (const r of relationships) {
            const list = map.get(r.relationType) ?? [];
            list.push(r);
            map.set(r.relationType, list);
        }
        return map;
    }, [relationships]);

    function bioRow(label: string, value: string | number | null | undefined) {
        if (!value && value !== 0) return null;
        return (
            <div key={label} className="grid grid-cols-[7rem_1fr] gap-1 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span>{value}</span>
            </div>
        );
    }

    const bioRows = [
        bioRow('Sex', person.sex ? SEX_LABEL[person.sex] : null),
        bioRow('Born', [person.birthDate, person.birthPlace].filter(Boolean).join(' · ')),
        bioRow('Died', [person.deathDate, person.deathPlace].filter(Boolean).join(' · ')),
        bioRow('GEDCOM ID', person.gedcomId),
    ].filter(Boolean);

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold">{person.fullName}</h2>
                    {person.nickname && <p className="text-sm text-muted-foreground">"{person.nickname}"</p>}
                </div>
                {isAdmin && (
                    <div className="flex shrink-0 gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => onEdit(person)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => onDelete(person)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                    </div>
                )}
            </div>

            <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Biography</h3>
                <div className="space-y-1 rounded-md border px-4 py-3">
                    {bioRows.length > 0 ? bioRows : <p className="text-sm text-muted-foreground">No biographical data recorded.</p>}
                </div>
                {person.notes && <p className="whitespace-pre-wrap rounded-md border px-4 py-3 text-sm">{person.notes}</p>}
            </section>

            <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Relationships</h3>
                {relationships.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No relationships recorded.</p>
                ) : (
                    <div className="space-y-4">
                        {(['spouse-of', 'parent-of', 'sibling-of', 'friend-of'] as const).map((type) => {
                            const rels = grouped.get(type);
                            if (!rels?.length) return null;
                            return (
                                <div key={type}>
                                    <p className="mb-1 text-xs font-medium text-muted-foreground">{REL_GROUP_LABEL[type]}</p>
                                    <div className="space-y-0.5">
                                        {rels.map((r) => {
                                            const related = personIndex.get(r.toPersonId);
                                            const name = related?.fullName ?? r.toPersonId;
                                            const span = related ? lifespan(related) : '';
                                            return (
                                                <button
                                                    key={r.id}
                                                    onClick={() => onSelectPerson(r.toPersonId)}
                                                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted"
                                                >
                                                    <span className="font-medium">{name}</span>
                                                    {span && <span className="text-xs text-muted-foreground">{span}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PersonsAdminPage() {
    const navigate = useNavigate();
    const { useGetMe } = useAuthQueries();
    const { data: me } = useGetMe();
    const isAdmin = me?.role === 'admin';
    const { useListPersons, useGetRelationships, useCreatePerson, useUpdatePerson, useDeletePerson } = useAdminPersonsQueries();

    const { data, isLoading, error } = useListPersons();
    const persons = useMemo(() => data ?? [], [data]);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
    const [editing, setEditing] = useState<AdminPerson | null>(null);
    const [deleting, setDeleting] = useState<AdminPerson | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const createPerson = useCreatePerson();
    const updatePerson = useUpdatePerson();
    const deletePerson = useDeletePerson();
    const { data: relationships } = useGetRelationships(selectedId);

    useEffect(() => {
        if (!isLoading) hideSplash();
    }, [isLoading]);

    const personIndex = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return persons;
        return persons.filter((p) => p.fullName.toLowerCase().includes(q) || (p.nickname?.toLowerCase().includes(q) ?? false));
    }, [persons, search]);

    const selected = selectedId ? (personIndex.get(selectedId) ?? null) : null;

    async function handleSubmit(input: PersonInput) {
        if (formMode === 'edit' && editing) {
            await updatePerson.mutateAsync({ id: editing.id, input });
            setToast(`Updated "${input.fullName}"`);
        } else {
            const created = await createPerson.mutateAsync(input);
            setSelectedId(created.id);
            setToast(`Created "${input.fullName}"`);
        }
    }

    async function confirmDelete() {
        if (!deleting) return;
        const name = deleting.fullName;
        try {
            await deletePerson.mutateAsync(deleting.id);
            if (selectedId === deleting.id) setSelectedId(null);
            setToast(`Deleted "${name}"`);
        } finally {
            setDeleting(null);
        }
    }

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
                        <span className="px-2 py-2 text-sm font-medium">Persons</span>
                    </div>
                    <div className="flex items-center gap-3 px-4">
                        <UserMenu />
                    </div>
                </div>
            }
            viewer={
                <div className="flex h-full overflow-hidden">
                    {/* ── Sidebar ── */}
                    <div className="flex w-72 shrink-0 flex-col border-r">
                        <div className="flex items-center gap-2 border-b px-3 py-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="h-8 pl-7 text-sm"
                                />
                            </div>
                            {isAdmin && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() => {
                                                setEditing(null);
                                                setFormMode('create');
                                            }}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>New person</TooltipContent>
                                </Tooltip>
                            )}
                        </div>

                        {toast && (
                            <div className="mx-2 mt-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                                {toast}
                                <button className="ml-1.5 underline" onClick={() => setToast(null)}>
                                    ×
                                </button>
                            </div>
                        )}
                        {error && (
                            <div className="mx-2 mt-2 rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                                {error instanceof Error ? error.message : String(error)}
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
                            ) : filtered.length === 0 ? (
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                    {search ? 'No matches.' : 'No persons yet.'}
                                </p>
                            ) : (
                                filtered.map((person) => {
                                    const span = lifespan(person);
                                    return (
                                        <button
                                            key={person.id}
                                            onClick={() => setSelectedId(person.id)}
                                            className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-muted ${
                                                selectedId === person.id ? 'bg-muted' : ''
                                            }`}
                                        >
                                            <span className="text-sm font-medium leading-tight">{person.fullName}</span>
                                            {(span || person.nickname) && (
                                                <span className="text-xs text-muted-foreground">
                                                    {[person.nickname ? `"${person.nickname}"` : null, span].filter(Boolean).join(' · ')}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {!isLoading && (
                            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                                {search
                                    ? `${filtered.length} of ${persons.length}`
                                    : `${persons.length} person${persons.length !== 1 ? 's' : ''}`}
                            </p>
                        )}
                    </div>

                    {/* ── Detail panel ── */}
                    <div className="flex-1 overflow-y-auto">
                        {selected ? (
                            <PersonDetail
                                person={selected}
                                relationships={relationships ?? []}
                                personIndex={personIndex}
                                isAdmin={isAdmin}
                                onEdit={(p) => {
                                    setEditing(p);
                                    setFormMode('edit');
                                }}
                                onDelete={setDeleting}
                                onSelectPerson={setSelectedId}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                Select a person to view details.
                            </div>
                        )}
                    </div>

                    {/* Dialogs */}
                    <PersonFormDialog
                        open={formMode !== null}
                        onOpenChange={(open) => !open && setFormMode(null)}
                        mode={formMode ?? 'create'}
                        initial={editing}
                        onSubmit={handleSubmit}
                    />
                    <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete person?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {deleting && (
                                        <>
                                            Remove <span className="font-medium">{deleting.fullName}</span> from the catalog. All
                                            relationships and photo tags will also be deleted.
                                        </>
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            }
        />
    );
}
