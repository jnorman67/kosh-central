import { apiFetch } from '@/lib/api-client';
import type { Comment, MentionInput } from '../models/comments.models';

export class CommentsService {
    async getComments(photoId: string): Promise<Comment[]> {
        return apiFetch<Comment[]>(`/api/comments/photo/${photoId}`);
    }

    async createComment(photoId: string, body: string, mentions: MentionInput[]): Promise<Comment> {
        return apiFetch<Comment>(`/api/comments/photo/${photoId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body, mentions }),
        });
    }

    async updateComment(commentId: string, body: string, mentions: MentionInput[]): Promise<Comment> {
        return apiFetch<Comment>(`/api/comments/${commentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body, mentions }),
        });
    }

    async deleteComment(commentId: string): Promise<void> {
        await apiFetch<void>(`/api/comments/${commentId}`, { method: 'DELETE' });
    }

    async getUsers(): Promise<{ id: string; displayName: string }[]> {
        return apiFetch<{ id: string; displayName: string }[]>('/api/auth/users');
    }
}
