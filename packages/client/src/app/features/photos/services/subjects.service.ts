import type { AdminPerson } from '@/app/features/admin/models/person.models';
import { apiFetch } from '@/lib/api-client';
import type { PhotoSubject, SubjectSuggestion } from '../models/subjects.models';

export class SubjectsService {
    async getPhotoSubjects(photoId: string): Promise<PhotoSubject[]> {
        return apiFetch<PhotoSubject[]>(`/api/photos/${encodeURIComponent(photoId)}/subjects`);
    }

    async getSubjectSuggestions(photoId: string): Promise<SubjectSuggestion[]> {
        return apiFetch<SubjectSuggestion[]>(`/api/photos/${encodeURIComponent(photoId)}/subject-suggestions`);
    }

    async addSubject(personId: string, photoId: string): Promise<PhotoSubject> {
        return apiFetch<PhotoSubject>(`/api/admin/persons/${encodeURIComponent(personId)}/photo-tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoId }),
        });
    }

    async removeSubject(personId: string, photoId: string): Promise<void> {
        await apiFetch<void>(`/api/admin/persons/${encodeURIComponent(personId)}/photo-tags/${encodeURIComponent(photoId)}`, {
            method: 'DELETE',
        });
    }

    async searchPersons(q: string): Promise<AdminPerson[]> {
        return apiFetch<AdminPerson[]>(`/api/persons?q=${encodeURIComponent(q)}`);
    }

    async setPortrait(personId: string, photoId: string | null): Promise<AdminPerson> {
        return apiFetch<AdminPerson>(`/api/admin/persons/${encodeURIComponent(personId)}/portrait`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoId }),
        });
    }
}
