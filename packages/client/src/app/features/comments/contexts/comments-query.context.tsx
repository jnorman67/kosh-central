import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createCommentsQueries, type CommentsQueries } from '../queries/comments.queries';
import { CommentsService } from '../services/comments.service';

interface CommentsQueriesType {
    comments: CommentsQueries;
}

const CommentsQueryContext = createContext<CommentsQueriesType | undefined>(undefined);

export function CommentsQueryProvider({ children }: { children: ReactNode }) {
    const services = useMemo(() => ({ commentsService: new CommentsService() }), []);
    const queries = useMemo(() => ({ comments: createCommentsQueries(services.commentsService) }), [services]);
    return <CommentsQueryContext.Provider value={queries}>{children}</CommentsQueryContext.Provider>;
}

export function useCommentsQueries() {
    const context = useContext(CommentsQueryContext);
    if (!context) {
        throw new Error('useCommentsQueries must be used within a CommentsQueryProvider');
    }
    return context.comments;
}
