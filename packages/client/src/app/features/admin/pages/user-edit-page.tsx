import { useAdminUsersQueries } from '@/app/features/admin/contexts/admin-query.context';
import type { AdminUser, Role, UserUpdate } from '@/app/features/admin/models/user.models';
import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api-client';
import { hideSplash } from '@/lib/splash';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/** Server timestamps are either ISO strings or SQLite's "YYYY-MM-DD HH:MM:SS" (UTC). */
function formatDate(value: string): string {
    const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

type Access = 'active' | 'revoked';

interface FormValues {
    displayName: string;
    email: string;
    role: Role;
    access: Access;
}

function valuesFor(user: AdminUser): FormValues {
    return {
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        access: user.disabledAt ? 'revoked' : 'active',
    };
}

/** Only the fields that differ from the saved user, trimmed the way the server stores them. */
function changesFrom(user: AdminUser, values: FormValues): UserUpdate {
    const saved = valuesFor(user);
    const update: UserUpdate = {};
    const displayName = values.displayName.trim();
    const email = values.email.trim();
    if (displayName !== saved.displayName) update.displayName = displayName;
    if (email !== saved.email) update.email = email;
    if (values.role !== saved.role) update.role = values.role;
    if (values.access !== saved.access) update.disabled = values.access === 'revoked';
    return update;
}

function UserEditForm({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
    const { useUpdateUser } = useAdminUsersQueries();
    const updateUser = useUpdateUser();

    const [values, setValues] = useState<FormValues>(() => valuesFor(user));
    const [error, setError] = useState<{ message: string; field?: string } | null>(null);
    const [saved, setSaved] = useState(false);
    const [confirmingRevoke, setConfirmingRevoke] = useState(false);

    const changes = changesFrom(user, values);
    const dirty = Object.keys(changes).length > 0;

    function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
        setValues((v) => ({ ...v, [key]: value }));
        setSaved(false);
    }

    function save() {
        setError(null);
        updateUser.mutate(
            { id: user.id, update: changes },
            {
                onSuccess: (updated) => {
                    setValues(valuesFor(updated));
                    setSaved(true);
                },
                onError: (err) =>
                    setError({
                        message: err instanceof Error ? err.message : String(err),
                        field: err instanceof ApiError ? err.field : undefined,
                    }),
            },
        );
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!dirty) return;
        if (changes.disabled === true) {
            setConfirmingRevoke(true);
            return;
        }
        save();
    }

    const fieldError = (field: string) => (error?.field === field ? error.message : null);
    const formError = error && !error.field ? error.message : null;

    return (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-md border p-6">
            <div className="space-y-1.5">
                <Label htmlFor="user-name">Name</Label>
                <Input
                    id="user-name"
                    value={values.displayName}
                    onChange={(e) => set('displayName', e.target.value)}
                    className={cn(fieldError('displayName') && 'border-destructive')}
                    required
                />
                {fieldError('displayName') && <p className="text-xs text-destructive">{fieldError('displayName')}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="user-email">Email</Label>
                <Input
                    id="user-email"
                    type="email"
                    value={values.email}
                    onChange={(e) => set('email', e.target.value)}
                    className={cn(fieldError('email') && 'border-destructive')}
                    required
                />
                <p className={cn('text-xs', fieldError('email') ? 'text-destructive' : 'text-muted-foreground')}>
                    {fieldError('email') ?? 'They sign in with this address. No email is sent when it changes, so let them know.'}
                </p>
            </div>

            <div className="flex flex-wrap gap-6">
                <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={values.role} onValueChange={(v) => set('role', v as Role)} disabled={isSelf}>
                        <SelectTrigger className="w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Access</Label>
                    <Select value={values.access} onValueChange={(v) => set('access', v as Access)} disabled={isSelf}>
                        <SelectTrigger className="w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="revoked">Revoked</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {isSelf && <p className="-mt-3 text-xs text-muted-foreground">You can't change your own role or revoke your own access.</p>}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Joined</dt>
                <dd>{formatDate(user.createdAt)}</dd>
                {user.disabledAt && (
                    <>
                        <dt className="text-muted-foreground">Access revoked</dt>
                        <dd>{formatDate(user.disabledAt)}</dd>
                    </>
                )}
            </dl>

            {formError && (
                <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>
            )}
            {saved && !dirty && (
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                    Changes saved.
                </div>
            )}

            <div className="flex gap-2">
                <Button type="submit" disabled={!dirty || updateUser.isPending}>
                    {updateUser.isPending ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={!dirty || updateUser.isPending}
                    onClick={() => {
                        setValues(valuesFor(user));
                        setError(null);
                    }}
                >
                    Discard
                </Button>
            </div>

            <AlertDialog open={confirmingRevoke} onOpenChange={setConfirmingRevoke}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke access?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-medium">{user.displayName}</span> will be signed out and won't be able to sign in again.
                            Their comments stay, and you can restore access later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={save}>Save and revoke access</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </form>
    );
}

export function UserEditPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { useGetMe } = useAuthQueries();
    const { data: me } = useGetMe();
    const { useListUsers } = useAdminUsersQueries();
    const { data, isLoading, error } = useListUsers();

    useEffect(() => {
        if (!isLoading) hideSplash();
    }, [isLoading]);

    const user = data?.users.find((u) => u.id === id);

    return (
        <ViewerLayout
            header={
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')} aria-label="Back to users">
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Back to users</TooltipContent>
                        </Tooltip>
                        <span className="truncate px-2 py-2 text-sm font-medium">Edit user</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 pr-1 sm:px-4">
                        <UserMenu />
                    </div>
                </div>
            }
            viewer={
                <div className="h-full overflow-auto">
                    <div className="mx-auto w-full max-w-xl space-y-6 p-6">
                        <div className="space-y-1">
                            <h1 className="text-xl font-semibold">{user?.displayName ?? 'Edit user'}</h1>
                            <p className="text-sm text-muted-foreground">
                                Change this person's name, sign-in email, role, or access. Passwords can only be changed by their owner.
                            </p>
                        </div>

                        {error ? (
                            <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {error instanceof Error ? error.message : String(error)}
                            </div>
                        ) : isLoading ? (
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : user ? (
                            <UserEditForm key={user.id} user={user} isSelf={user.id === me?.id} />
                        ) : (
                            <p className="text-sm text-muted-foreground">This user doesn't exist.</p>
                        )}
                    </div>
                </div>
            }
        />
    );
}
