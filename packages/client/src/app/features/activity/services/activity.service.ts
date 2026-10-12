import { apiFetch } from '@/lib/api-client';
import type { ActivityPage, ActivityStatus } from '../models/activity.models';

export class ActivityService {
    async getPage(cursor: string | null): Promise<ActivityPage> {
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        return apiFetch<ActivityPage>(`/api/comments/activity${query}`);
    }

    async getStatus(): Promise<ActivityStatus> {
        return apiFetch<ActivityStatus>('/api/comments/activity/status');
    }

    /** Returns when the user had last seen the feed before now. */
    async markSeen(): Promise<{ previousSeenAt: string | null }> {
        return apiFetch<{ previousSeenAt: string | null }>('/api/comments/activity/seen', { method: 'POST' });
    }
}
