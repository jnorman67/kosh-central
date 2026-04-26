import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createSubjectsQueries, type SubjectsQueries } from '../queries/subjects.queries';
import { SubjectsService } from '../services/subjects.service';

const SubjectsQueryContext = createContext<SubjectsQueries | undefined>(undefined);

export function SubjectsQueryProvider({ children }: { children: ReactNode }) {
    const service = useMemo(() => new SubjectsService(), []);
    const queries = useMemo(() => createSubjectsQueries(service), [service]);
    return <SubjectsQueryContext.Provider value={queries}>{children}</SubjectsQueryContext.Provider>;
}

export function useSubjectsQueries() {
    const context = useContext(SubjectsQueryContext);
    if (!context) {
        throw new Error('useSubjectsQueries must be used within a SubjectsQueryProvider');
    }
    return context;
}
