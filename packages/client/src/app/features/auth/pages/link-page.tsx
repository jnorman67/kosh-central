import { useAuthQueries } from '@/app/features/auth/contexts/auth-query.context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { hideSplash } from '@/lib/splash';
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

/** Landing page for a one-time sign-in link (/link/:token): signs in and moves on. */
export function LinkPage() {
    const { token = '' } = useParams();
    const navigate = useNavigate();
    const { useRedeemLink } = useAuthQueries();
    const redeem = useRedeemLink();
    // The link only works once, so StrictMode's second effect run mustn't redeem it again.
    const redeemed = useRef(false);

    useEffect(() => hideSplash(), []);

    useEffect(() => {
        if (redeemed.current) return;
        redeemed.current = true;
        // The featured page forwards to the viewer when no album is featured.
        redeem.mutate(token, { onSuccess: () => navigate('/featured', { replace: true }) });
    }, [redeem, token, navigate]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 to-background px-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">{redeem.isError ? 'Link not valid' : 'Signing you in…'}</CardTitle>
                    {redeem.isError && <CardDescription>{redeem.error.message}</CardDescription>}
                </CardHeader>
                {redeem.isError && (
                    <CardContent>
                        <p className="text-center text-sm text-muted-foreground">
                            Have a password?{' '}
                            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </CardContent>
                )}
            </Card>
        </div>
    );
}
