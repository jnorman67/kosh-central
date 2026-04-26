import { createAdminFoldersQueries, type AdminFoldersQueries } from '@/app/features/admin/queries/admin-folders.queries';
import { createAdminPersonsQueries, type AdminPersonsQueries } from '@/app/features/admin/queries/admin-persons.queries';
import { AdminFoldersService } from '@/app/features/admin/services/admin-folders.service';
import { AdminPersonsService } from '@/app/features/admin/services/admin-persons.service';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface AdminQueriesType {
    folders: AdminFoldersQueries;
    persons: AdminPersonsQueries;
    foldersService: AdminFoldersService;
}

const AdminQueryContext = createContext<AdminQueriesType | undefined>(undefined);

export function AdminQueryProvider({ children }: { children: ReactNode }) {
    const services = useMemo(
        () => ({ foldersService: new AdminFoldersService(), personsService: new AdminPersonsService() }),
        [],
    );
    const value = useMemo<AdminQueriesType>(
        () => ({
            folders: createAdminFoldersQueries(services.foldersService),
            persons: createAdminPersonsQueries(services.personsService),
            foldersService: services.foldersService,
        }),
        [services],
    );

    return <AdminQueryContext.Provider value={value}>{children}</AdminQueryContext.Provider>;
}

export function useAdminFoldersQueries() {
    const context = useContext(AdminQueryContext);
    if (!context) throw new Error('useAdminFoldersQueries must be used within an AdminQueryProvider');
    return context.folders;
}

export function useAdminFoldersService() {
    const context = useContext(AdminQueryContext);
    if (!context) throw new Error('useAdminFoldersService must be used within an AdminQueryProvider');
    return context.foldersService;
}

export function useAdminPersonsQueries() {
    const context = useContext(AdminQueryContext);
    if (!context) throw new Error('useAdminPersonsQueries must be used within an AdminQueryProvider');
    return context.persons;
}
