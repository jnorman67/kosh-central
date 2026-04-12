import { createAuthQueries, type AuthQueries } from '@/app/features/auth/queries/auth.queries';
import { AuthService } from '@/app/features/auth/services/auth.service';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface AuthQueriesType {
    auth: AuthQueries;
}

const AuthQueryContext = createContext<AuthQueriesType | undefined>(undefined);

export function AuthQueryProvider({ children }: { children: ReactNode }) {
    const services = useMemo(() => ({ authService: new AuthService() }), []);
    const queries = useMemo(() => ({ auth: createAuthQueries(services.authService) }), [services]);

    return <AuthQueryContext.Provider value={queries}>{children}</AuthQueryContext.Provider>;
}

export function useAuthQueries() {
    const context = useContext(AuthQueryContext);
    if (!context) {
        throw new Error('useAuthQueries must be used within an AuthQueryProvider');
    }
    return context.auth;
}
