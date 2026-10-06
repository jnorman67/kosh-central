import { createAdminFoldersQueries, type AdminFoldersQueries } from '@/app/features/admin/queries/admin-folders.queries';
import { createAdminPersonsQueries, type AdminPersonsQueries } from '@/app/features/admin/queries/admin-persons.queries';
import { createAdminUsersQueries, type AdminUsersQueries } from '@/app/features/admin/queries/admin-users.queries';
import { AdminFoldersService } from '@/app/features/admin/services/admin-folders.service';
import { AdminPersonsService } from '@/app/features/admin/services/admin-persons.service';
import { AdminUsersService } from '@/app/features/admin/services/admin-users.service';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface AdminQueriesType {
    folders: AdminFoldersQueries;
    persons: AdminPersonsQueries;
    users: AdminUsersQueries;
    foldersService: AdminFoldersService;
}

const AdminQueryContext = createContext<AdminQueriesType | undefined>(undefined);

export function AdminQueryProvider({ children }: { children: ReactNode }) {
    const services = useMemo(
        () => ({
            foldersService: new AdminFoldersService(),
            personsService: new AdminPersonsService(),
            usersService: new AdminUsersService(),
        }),
        [],
    );
    const value = useMemo<AdminQueriesType>(
        () => ({
            folders: createAdminFoldersQueries(services.foldersService),
            persons: createAdminPersonsQueries(services.personsService),
            users: createAdminUsersQueries(services.usersService),
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

export function useAdminUsersQueries() {
    const context = useContext(AdminQueryContext);
    if (!context) throw new Error('useAdminUsersQueries must be used within an AdminQueryProvider');
    return context.users;
}
