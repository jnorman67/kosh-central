import { useAdminUsersQueries } from '@/app/features/admin/contexts/admin-query.context';
import type { AdminUser, Role } from '@/app/features/admin/models/user.models';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { hideSplash } from '@/lib/splash';
import { cn } from '@/lib/utils';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/** Server timestamps are either ISO strings or SQLite's "YYYY-MM-DD HH:MM:SS" (UTC). */
function formatDate(value: string): string {
    const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function RoleSelect({ value, onChange, disabled }: { value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
    return (
        <Select value={value} onValueChange={(v) => onChange(v as Role)} disabled={disabled}>
            <SelectTrigger className="h-8 w-28">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
        </Select>
    );
}

export function UsersAdminPage() {
    const backToViewer = useBackToViewer();
    const { useGetMe } = useAuthQueries();
    const { data: me } = useGetMe();
    const { useListUsers, useUpdateUser, useCreateInvite, useUpdateInvite, useDeleteInvite } = useAdminUsersQueries();

    const { data, isLoading, error } = useListUsers();
    const updateUser = useUpdateUser();
    const createInvite = useCreateInvite();
    const updateInvite = useUpdateInvite();
    const deleteInvite = useDeleteInvite();

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<Role>('user');
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [revoking, setRevoking] = useState<AdminUser | null>(null);

    useEffect(() => {
        if (!isLoading) hideSplash();
    }, [isLoading]);

    const users = data?.users ?? [];
    const invites = data?.invites ?? [];

    function report(message: string) {
        setActionError(null);
        setToast(message);
    }

    function fail(err: unknown) {
        setToast(null);
        setActionError(errorMessage(err));
    }

    function handleInvite(e: React.FormEvent) {
        e.preventDefault();
        setInviteError(null);
        const email = inviteEmail.trim();
        createInvite.mutate(
            { email, role: inviteRole },
            {
                onSuccess: () => {
                    setInviteEmail('');
                    setInviteRole('user');
                    report(`Invited ${email}`);
                },
                onError: (err) => setInviteError(errorMessage(err)),
            },
        );
    }

    function changeUser(user: AdminUser, update: { role?: Role; disabled?: boolean }, message: string) {
        updateUser.mutate({ id: user.id, update }, { onSuccess: () => report(message), onError: fail });
    }

    function confirmRevoke() {
        if (!revoking) return;
        changeUser(revoking, { disabled: true }, `Revoked access for ${revoking.displayName}`);
        setRevoking(null);
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
                        <span className="truncate px-2 py-2 text-sm font-medium">Users & invites</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 pr-1 sm:px-4">
                        <UserMenu />
                    </div>
                </div>
            }
            viewer={
                <div className="h-full overflow-auto">
                    <div className="mx-auto w-full max-w-4xl space-y-8 p-6">
                        <div className="space-y-1">
                            <h1 className="text-xl font-semibold">Users & invites</h1>
                            <p className="text-sm text-muted-foreground">
                                Only invited email addresses can create an account. Once someone registers, their invite moves to the users
                                list.
                            </p>
                        </div>

                        {toast && (
                            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                                {toast}
                                <button className="ml-2 underline" onClick={() => setToast(null)}>
                                    ×
                                </button>
                            </div>
                        )}
                        {(actionError || error) && (
                            <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {actionError ?? errorMessage(error)}
                            </div>
                        )}

                        <section className="space-y-3">
                            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Invite someone</h2>
                            <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3 rounded-md border p-4">
                                <div className="min-w-64 flex-1 space-y-1.5">
                                    <Label htmlFor="invite-email">Email</Label>
                                    <Input
                                        id="invite-email"
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="name@example.com"
                                        className={cn(inviteError && 'border-destructive')}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Role</Label>
                                    <RoleSelect value={inviteRole} onChange={setInviteRole} />
                                </div>
                                <Button type="submit" disabled={createInvite.isPending}>
                                    {createInvite.isPending ? 'Inviting…' : 'Invite'}
                                </Button>
                                <p className="w-full text-xs text-muted-foreground">
                                    {inviteError ? (
                                        <span className="text-destructive">{inviteError}</span>
                                    ) : (
                                        <>
                                            No email is sent. Tell them to register at{' '}
                                            <span className="font-medium">{window.location.origin}/register</span> with this address.
                                        </>
                                    )}
                                </p>
                            </form>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                                Pending invites{invites.length > 0 && ` (${invites.length})`}
                            </h2>
                            {invites.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{isLoading ? 'Loading…' : 'No pending invites.'}</p>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Email</TableHead>
                                                <TableHead className="w-32">Role</TableHead>
                                                <TableHead className="w-28">Invited</TableHead>
                                                <TableHead className="w-12" />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {invites.map((invite) => (
                                                <TableRow key={invite.email}>
                                                    <TableCell className="font-medium">{invite.email}</TableCell>
                                                    <TableCell>
                                                        <RoleSelect
                                                            value={invite.role}
                                                            onChange={(role) =>
                                                                updateInvite.mutate(
                                                                    { email: invite.email, role },
                                                                    {
                                                                        onSuccess: () => report(`${invite.email} will join as ${role}`),
                                                                        onError: fail,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{formatDate(invite.createdAt)}</TableCell>
                                                    <TableCell>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    aria-label={`Remove invite for ${invite.email}`}
                                                                    onClick={() =>
                                                                        deleteInvite.mutate(invite.email, {
                                                                            onSuccess: () => report(`Removed invite for ${invite.email}`),
                                                                            onError: fail,
                                                                        })
                                                                    }
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Remove invite</TooltipContent>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                                Users{users.length > 0 && ` (${users.length})`}
                            </h2>
                            {users.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{isLoading ? 'Loading…' : 'No users yet.'}</p>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead className="w-32">Role</TableHead>
                                                <TableHead className="w-28">Joined</TableHead>
                                                <TableHead className="w-48" />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {users.map((user) => {
                                                const isSelf = user.id === me?.id;
                                                const disabled = !!user.disabledAt;
                                                return (
                                                    <TableRow key={user.id} className={cn(disabled && 'text-muted-foreground')}>
                                                        <TableCell>
                                                            <div className="font-medium">
                                                                <Link
                                                                    to={`/admin/users/${encodeURIComponent(user.id)}`}
                                                                    className="hover:underline"
                                                                >
                                                                    {user.displayName}
                                                                </Link>
                                                                {isSelf && <span className="ml-1.5 text-xs font-normal">(you)</span>}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {user.email}
                                                                {disabled && ` · access revoked ${formatDate(user.disabledAt!)}`}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <RoleSelect
                                                                value={user.role}
                                                                disabled={isSelf || disabled}
                                                                onChange={(role) =>
                                                                    changeUser(
                                                                        user,
                                                                        { role },
                                                                        `${user.displayName} is now ${role === 'admin' ? 'an admin' : 'a user'}`,
                                                                    )
                                                                }
                                                            />
                                                        </TableCell>
                                                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                                                        <TableCell className="space-x-1 text-right">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                                        <Link
                                                                            to={`/admin/users/${encodeURIComponent(user.id)}`}
                                                                            aria-label={`Edit ${user.displayName}`}
                                                                        >
                                                                            <Pencil className="h-4 w-4" />
                                                                        </Link>
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Edit user</TooltipContent>
                                                            </Tooltip>
                                                            {!isSelf &&
                                                                (disabled ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            changeUser(
                                                                                user,
                                                                                { disabled: false },
                                                                                `Restored access for ${user.displayName}`,
                                                                            )
                                                                        }
                                                                    >
                                                                        Restore access
                                                                    </Button>
                                                                ) : (
                                                                    <Button variant="outline" size="sm" onClick={() => setRevoking(user)}>
                                                                        Revoke access
                                                                    </Button>
                                                                ))}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </section>
                    </div>

                    <AlertDialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Revoke access?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {revoking && (
                                        <>
                                            <span className="font-medium">{revoking.displayName}</span> will be signed out and won't be able
                                            to sign in again. Their comments stay, and you can restore access later.
                                        </>
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={confirmRevoke}>Revoke access</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            }
        />
    );
}
