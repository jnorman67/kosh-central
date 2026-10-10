import { MergePersonDialog } from '@/app/features/admin/components/merge-person-dialog';
import { PersonFormDialog } from '@/app/features/admin/components/person-form-dialog';
import { useAdminPersonsQueries, useAdminUsersQueries } from '@/app/features/admin/contexts/admin-query.context';
import type { AdminPerson, PersonInput, PersonRelationship } from '@/app/features/admin/models/person.models';
import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { useBackToViewer } from '@/app/features/photos/hooks/use-back-to-viewer';
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
import { ArrowLeft, Check, Merge, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

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
    suggestedBy,
    onEdit,
    onDelete,
    onApprove,
    onMerge,
    onReject,
    onSelectPerson,
}: {
    person: AdminPerson;
    relationships: PersonRelationship[];
    personIndex: Map<string, AdminPerson>;
    isAdmin: boolean;
    suggestedBy: string | null;
    onEdit: (p: AdminPerson) => void;
    onDelete: (p: AdminPerson) => void;
    onApprove: (p: AdminPerson) => void;
    onMerge: (p: AdminPerson) => void;
    onReject: (p: AdminPerson) => void;
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
                        {!person.proposed && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={() => onDelete(person)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                )}
            </div>

            {person.proposed && (
                <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <p className="text-sm">
                        Suggested
                        {suggestedBy && (
                            <>
                                {' '}
                                by <span className="font-medium">{suggestedBy}</span>
                            </>
                        )}{' '}
                        on {new Date(person.createdAt.replace(' ', 'T') + 'Z').toLocaleDateString()}. Not yet in the index.
                    </p>
                    {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => onApprove(person)}>
                                <Check className="h-4 w-4" />
                                Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onMerge(person)}>
                                <Merge className="h-4 w-4" />
                                Merge into…
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onReject(person)}>
                                <X className="h-4 w-4" />
                                Reject
                            </Button>
                        </div>
                    )}
                </div>
            )}

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
    const backToViewer = useBackToViewer();
    const { useGetMe } = useAuthQueries();
    const { data: me } = useGetMe();
    const isAdmin = me?.role === 'admin';
    const {
        useListPersons,
        useGetRelationships,
        useCreatePerson,
        useUpdatePerson,
        useDeletePerson,
        useApprovePerson,
        useMergePerson,
        useRejectPerson,
    } = useAdminPersonsQueries();
    const { useListUsers } = useAdminUsersQueries();
    const { data: usersData } = useListUsers({ enabled: isAdmin });
    const userNames = useMemo(() => new Map((usersData?.users ?? []).map((u) => [u.id, u.displayName])), [usersData]);

    const { data, isLoading, error } = useListPersons();
    const persons = useMemo(() => data ?? [], [data]);

    // The selected person lives in the URL so the browser's back button and reloads keep it.
    const [params, setParams] = useSearchParams();
    const selectedId = params.get('person');
    const setSelectedId = useCallback((id: string | null) => setParams(id ? { person: id } : {}, { replace: true }), [setParams]);
    const [search, setSearch] = useState('');
    const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
    const [editing, setEditing] = useState<AdminPerson | null>(null);
    const [deleting, setDeleting] = useState<AdminPerson | null>(null);
    const [merging, setMerging] = useState<AdminPerson | null>(null);
    const [rejecting, setRejecting] = useState<AdminPerson | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const createPerson = useCreatePerson();
    const updatePerson = useUpdatePerson();
    const deletePerson = useDeletePerson();
    const approvePerson = useApprovePerson();
    const mergePerson = useMergePerson();
    const rejectPerson = useRejectPerson();
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

    // Suggestions awaiting review are listed apart from the formal index.
    const pending = useMemo(() => filtered.filter((p) => p.proposed), [filtered]);
    const indexed = useMemo(() => filtered.filter((p) => !p.proposed), [filtered]);
    const indexedTotal = useMemo(() => persons.filter((p) => !p.proposed).length, [persons]);

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

    function handleApprove(person: AdminPerson) {
        approvePerson.mutate(person.id, { onSuccess: () => setToast(`Added "${person.fullName}" to the index`) });
    }

    async function handleMerge(intoPersonId: string) {
        if (!merging) return;
        const name = merging.fullName;
        const target = await mergePerson.mutateAsync({ id: merging.id, intoPersonId });
        setSelectedId(target.id);
        setToast(`Merged "${name}" into "${target.fullName}"`);
    }

    async function confirmReject() {
        if (!rejecting) return;
        const name = rejecting.fullName;
        try {
            await rejectPerson.mutateAsync(rejecting.id);
            if (selectedId === rejecting.id) setSelectedId(null);
            setToast(`Rejected "${name}"`);
        } finally {
            setRejecting(null);
        }
    }

    function renderPersonRow(person: AdminPerson) {
        const span = lifespan(person);
        return (
            <button
                key={person.id}
                onClick={() => setSelectedId(person.id)}
                className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-muted ${selectedId === person.id ? 'bg-muted' : ''}`}
            >
                <span className="text-sm font-medium leading-tight">{person.fullName}</span>
                {(span || person.nickname) && (
                    <span className="text-xs text-muted-foreground">
                        {[person.nickname ? `"${person.nickname}"` : null, span].filter(Boolean).join(' · ')}
                    </span>
                )}
            </button>
        );
    }

    return (
        <ViewerLayout
            header={
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={backToViewer} aria-label="Back to viewer">
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Back to viewer</TooltipContent>
                        </Tooltip>
                        <span className="truncate px-2 py-2 text-sm font-medium">Persons</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 pr-1 sm:px-4">
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
                                <>
                                    {pending.length > 0 && (
                                        <div className="border-b bg-amber-500/5">
                                            <p className="px-4 pb-1 pt-2.5 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                                Awaiting review ({pending.length})
                                            </p>
                                            {pending.map(renderPersonRow)}
                                        </div>
                                    )}
                                    {indexed.map(renderPersonRow)}
                                </>
                            )}
                        </div>

                        {!isLoading && (
                            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                                {search ? `${indexed.length} of ${indexedTotal}` : `${indexedTotal} person${indexedTotal !== 1 ? 's' : ''}`}
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
                                suggestedBy={selected.createdBy ? (userNames.get(selected.createdBy) ?? null) : null}
                                onEdit={(p) => {
                                    setEditing(p);
                                    setFormMode('edit');
                                }}
                                onDelete={setDeleting}
                                onApprove={handleApprove}
                                onMerge={setMerging}
                                onReject={setRejecting}
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
                    <MergePersonDialog
                        source={merging}
                        persons={persons}
                        onOpenChange={(open) => !open && setMerging(null)}
                        onMerge={handleMerge}
                    />
                    <AlertDialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Reject suggestion?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {rejecting && (
                                        <>
                                            Remove <span className="font-medium">{rejecting.fullName}</span> along with any photo tags using
                                            this name. To keep the tags under someone already in the index, use Merge instead.
                                        </>
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmReject}>Reject</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
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
