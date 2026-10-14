import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { viewerLocation } from '@/app/features/photos/lib/places';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hideSplash } from '@/lib/splash';
import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export function ChangePasswordPage() {
    const { useGetMe, useChangePassword } = useAuthQueries();
    const { data: me } = useGetMe();
    const changePassword = useChangePassword();
    // People who joined by invite link have no password; setting one is optional.
    const settingFirst = me?.hasPassword === false;

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [clientError, setClientError] = useState('');
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => hideSplash(), []);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setClientError('');
        setSuccess(null);

        if (newPassword !== confirmPassword) {
            setClientError('New passwords do not match');
            return;
        }

        if (!settingFirst && newPassword === currentPassword) {
            setClientError('New password must be different from current password');
            return;
        }

        changePassword.mutate(
            { currentPassword, newPassword },
            {
                onSuccess: (message) => {
                    setSuccess(`${message}.`);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                },
            },
        );
    }

    const error = clientError || (changePassword.isError ? changePassword.error.message : '');

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 to-background px-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">{settingFirst ? 'Set a password' : 'Change password'}</CardTitle>
                    <CardDescription>
                        {settingFirst
                            ? "Optional. You'll stay signed in on this device either way; a password lets you sign in on others."
                            : 'Update the password for your account'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!settingFirst && (
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current password</Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    required
                                    autoComplete="current-password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm new password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}
                        {success && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>}

                        <Button type="submit" className="w-full" disabled={changePassword.isPending}>
                            {changePassword.isPending ? 'Saving...' : settingFirst ? 'Set password' : 'Update password'}
                        </Button>
                    </form>

                    <p className="mt-4 text-center text-sm text-muted-foreground">
                        <Link to={viewerLocation()} className="text-primary underline-offset-4 hover:underline">
                            Back to photos
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
