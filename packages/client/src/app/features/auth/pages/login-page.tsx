import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

export function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { useLogin } = useAuthQueries();
    const login = useLogin();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const registered = searchParams.get('registered') === 'true';

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        login.mutate(
            { email, password },
            {
                onSuccess: () => navigate('/', { replace: true }),
            },
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Sign in</CardTitle>
                    <CardDescription>Enter your credentials to access Kosh Central</CardDescription>
                </CardHeader>
                <CardContent>
                    {registered && (
                        <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">Account created. Please sign in.</p>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {login.isError && <p className="text-sm text-destructive">{login.error.message}</p>}

                        <Button type="submit" className="w-full" disabled={login.isPending}>
                            {login.isPending ? 'Signing in...' : 'Sign in'}
                        </Button>
                    </form>

                    <p className="mt-4 text-center text-sm text-muted-foreground">
                        Been invited?{' '}
                        <Link to="/register" className="text-primary underline-offset-4 hover:underline">
                            Create an account
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
