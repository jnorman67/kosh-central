import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createActivityQueries, type ActivityQueries } from '../queries/activity.queries';
import { ActivityService } from '../services/activity.service';

interface ActivityQueriesType {
    activity: ActivityQueries;
}

const ActivityQueryContext = createContext<ActivityQueriesType | undefined>(undefined);

export function ActivityQueryProvider({ children }: { children: ReactNode }) {
    const services = useMemo(() => ({ activityService: new ActivityService() }), []);
    const queries = useMemo(() => ({ activity: createActivityQueries(services.activityService) }), [services]);
    return <ActivityQueryContext.Provider value={queries}>{children}</ActivityQueryContext.Provider>;
}

export function useActivityQueries() {
    const context = useContext(ActivityQueryContext);
    if (!context) {
        throw new Error('useActivityQueries must be used within an ActivityQueryProvider');
    }
    return context.activity;
}
