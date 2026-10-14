import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hideSplash } from '@/lib/splash';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

/** Landing page for an invite link (/join/:token): asks only for a name, then signs in. */
export function JoinPage() {
    const { token = '' } = useParams();
    const navigate = useNavigate();
    const { useInviteLink, useJoin } = useAuthQueries();
    const invite = useInviteLink(token);
    const join = useJoin();

    const [displayName, setDisplayName] = useState('');

    useEffect(() => {
        if (!invite.isLoading) hideSplash();
    }, [invite.isLoading]);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        join.mutate(
            { token, displayName: displayName.trim() },
            // The featured page forwards to the viewer when no album is featured.
            { onSuccess: () => navigate('/featured', { replace: true }) },
        );
    }

    if (invite.isLoading) return null;

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 to-background px-4">
            <Card className="w-full max-w-sm">
                {invite.isError ? (
                    <>
                        <CardHeader>
                            <CardTitle className="text-2xl">Link not valid</CardTitle>
                            <CardDescription>{invite.error.message}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-center text-sm text-muted-foreground">
                                Already joined?{' '}
                                <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                                    Sign in
                                </Link>
                            </p>
                        </CardContent>
                    </>
                ) : (
                    <>
                        <CardHeader>
                            <CardTitle className="text-2xl">Welcome to Kosh Central</CardTitle>
                            <CardDescription>
                                You're invited as <span className="font-medium text-foreground">{invite.data}</span>. Tell us your name and
                                you're in.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="displayName">Your name</Label>
                                    <Input
                                        id="displayName"
                                        type="text"
                                        required
                                        autoFocus
                                        autoComplete="name"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">Shown next to your comments.</p>
                                </div>

                                {join.isError && <p className="text-sm text-destructive">{join.error.message}</p>}

                                <Button type="submit" className="w-full" disabled={join.isPending}>
                                    {join.isPending ? 'Joining…' : 'Join'}
                                </Button>
                            </form>
                        </CardContent>
                    </>
                )}
            </Card>
        </div>
    );
}
